import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { streamHandle } from "hono/aws-lambda";
import { createApp } from "./app";
import { openAICompatibleEngine } from "./engine";
import { gpuResolver } from "./gpu";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const ssm = new SSMClient({});
async function secret(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  if (!res.Parameter?.Value) throw new Error(`SSM parameter ${name} is empty`);
  return res.Parameter.Value;
}

const [apiKey, inferenceApiKey] = await Promise.all([
  secret(env("API_KEY_PARAMETER")),
  secret(env("INFERENCE_API_KEY_PARAMETER")),
]);

const gpu = gpuResolver({
  asgName: env("GPU_ASG_NAME"),
  ports: { chat: Number(env("CHAT_PORT")), embed: Number(env("EMBED_PORT")) },
});

const app = createApp({
  apiKey,
  engine: openAICompatibleEngine({
    baseURL: gpu.baseURL,
    apiKey: inferenceApiKey,
    chatModel: env("CHAT_MODEL"),
    embedModel: env("EMBED_MODEL"),
    onUnreachable: gpu.forget,
  }),
});

export const handler: ReturnType<typeof streamHandle> = streamHandle(app);
