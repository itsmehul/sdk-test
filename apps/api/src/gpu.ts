import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  SetDesiredCapacityCommand,
} from "@aws-sdk/client-auto-scaling";
import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { UpstreamError } from "./engine";

type Kind = "chat" | "embed";

export type GpuConfig = {
  asgName: string;
  ports: Record<Kind, number>;
  /** Seconds clients should wait while the instance boots and loads models. */
  retryAfter?: number;
};

const HEALTHY_TTL_MS = 30_000;

/**
 * Resolves the vLLM base URL on the scale-to-zero GPU instance. When no instance is running it
 * raises the Auto Scaling group to one and answers 503 `model_loading` until vLLM is healthy.
 * The instance terminates itself after it has been idle.
 */
export function gpuResolver(config: GpuConfig) {
  const ec2 = new EC2Client({});
  const autoscaling = new AutoScalingClient({});
  const healthy = new Map<Kind, { url: string; at: number }>();

  const loading = (detail: string) =>
    new UpstreamError(
      `Model is starting up (${detail}). Retry shortly.`,
      503,
      "model_loading",
      config.retryAfter ?? 60,
    );

  async function instanceIp(): Promise<string | undefined> {
    const res = await ec2.send(
      new DescribeInstancesCommand({
        Filters: [
          { Name: "tag:aws:autoscaling:groupName", Values: [config.asgName] },
          { Name: "instance-state-name", Values: ["pending", "running"] },
        ],
      }),
    );
    const instances = res.Reservations?.flatMap((r) => r.Instances ?? []) ?? [];
    if (instances.length === 0) return undefined;
    const running = instances.find((i) => i.State?.Name === "running" && i.PrivateIpAddress);
    if (!running?.PrivateIpAddress) throw loading("instance is booting");
    return running.PrivateIpAddress;
  }

  async function wake() {
    const res = await autoscaling.send(
      new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [config.asgName] }),
    );
    if ((res.AutoScalingGroups?.[0]?.DesiredCapacity ?? 0) === 0) {
      await autoscaling.send(
        new SetDesiredCapacityCommand({ AutoScalingGroupName: config.asgName, DesiredCapacity: 1 }),
      );
    }
  }

  async function baseURL(kind: Kind): Promise<string> {
    const cached = healthy.get(kind);
    if (cached && Date.now() - cached.at < HEALTHY_TTL_MS) return cached.url;

    const ip = await instanceIp();
    if (!ip) {
      await wake();
      throw loading("launching GPU instance");
    }

    const origin = `http://${ip}:${config.ports[kind]}`;
    const ok = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(2_000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) throw loading(`loading ${kind} model`);

    const url = `${origin}/v1`;
    healthy.set(kind, { url, at: Date.now() });
    return url;
  }

  return { baseURL, forget: (kind: Kind) => healthy.delete(kind) };
}
