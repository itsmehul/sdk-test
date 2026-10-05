import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { cancel, intro, isCancel, log, outro, select, spinner } from "@clack/prompts";
import { execa } from "execa";
import pc from "picocolors";

type Task = { label: string; hint: string; command: string; args: string[] };

const example = (file: string): string[] => ["--env-file-if-exists=.env", `examples/src/${file}`];

const tasks = {
  codegen: {
    label: "Generate spec and SDK types",
    hint: "apps/api → openapi/openapi.json → packages/sdk/src/generated",
    command: "turbo",
    args: ["run", "generate"],
  },
  build: {
    label: "Build packages",
    hint: "tsdown dual ESM/CJS + .d.ts",
    command: "turbo",
    args: ["run", "build"],
  },
  test: {
    label: "Run tests",
    hint: "vitest contract and unit tests",
    command: "turbo",
    args: ["run", "test"],
  },
  typecheck: {
    label: "Typecheck",
    hint: "tsc --noEmit across the workspace",
    command: "turbo",
    args: ["run", "typecheck"],
  },
  lint: {
    label: "Lint",
    hint: "biome check",
    command: "biome",
    args: ["check", "."],
  },
  format: {
    label: "Lint and fix",
    hint: "biome check --write",
    command: "biome",
    args: ["check", "--write", "."],
  },
  pkgcheck: {
    label: "Check published packages",
    hint: "publint + are-the-types-wrong",
    command: "turbo",
    args: ["run", "lint:pkg", "lint:types"],
  },
  exampleSdk: {
    label: "@interfaze/sdk",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("sdk.ts"),
  },
  exampleAiSdk: {
    label: "@interfaze/ai-sdk-provider",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("ai-sdk.ts"),
  },
  exampleLangchain: {
    label: "@interfaze/langchain",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("langchain.ts"),
  },
  changeset: {
    label: "Add changeset",
    hint: "Describe a change for the next release",
    command: "changeset",
    args: [],
  },
  changesetStatus: {
    label: "Release status",
    hint: "Pending version bumps",
    command: "changeset",
    args: ["status", "--verbose"],
  },
  version: {
    label: "Version packages",
    hint: "Apply changesets locally (CI normally does this)",
    command: "changeset",
    args: ["version"],
  },
} as const satisfies Record<string, Task>;

type TaskId = keyof typeof tasks;

const groups: ReadonlyArray<{ label: string; hint: string; tasks: readonly TaskId[] }> = [
  { label: "Codegen", hint: "OpenAPI spec and generated types", tasks: ["codegen"] },
  {
    label: "Quality",
    hint: "Build, test, lint",
    tasks: ["build", "test", "typecheck", "lint", "format", "pkgcheck"],
  },
  {
    label: "Examples",
    hint: "Call the local API through each package",
    tasks: ["exampleSdk", "exampleAiSdk", "exampleLangchain"],
  },
  { label: "Release", hint: "Changesets", tasks: ["changeset", "changesetStatus", "version"] },
];

function check(label: string, ok: boolean, missing: string) {
  log.info(`${label}: ${ok ? pc.green("ok") : pc.yellow(missing)}`);
}

console.clear();
intro(pc.bgCyan(pc.black(" interfaze sdk ")));

try {
  loadEnvFile();
} catch {}

check(".env", existsSync(".env"), "missing (copy .env.example)");
check("INTERFAZE_API_KEY", Boolean(process.env.INTERFAZE_API_KEY), "not set");
check("OpenAPI spec", existsSync("openapi/openapi.json"), "missing (run codegen)");
check("SDK types", existsSync("packages/sdk/src/generated/schema.d.ts"), "missing (run codegen)");
check("Build output", existsSync("packages/sdk/dist/index.mjs"), "missing (run build)");

const groupIndex = await select({
  message: "Group",
  options: groups.map((group, value) => ({ value, label: group.label, hint: group.hint })),
});
if (isCancel(groupIndex)) {
  cancel("Cancelled");
  process.exit(0);
}

const taskId = await select<TaskId>({
  message: "Task",
  options: (groups[groupIndex]?.tasks ?? []).map((id) => ({
    value: id,
    label: tasks[id].label,
    hint: tasks[id].hint,
  })),
});
if (isCancel(taskId)) {
  cancel("Cancelled");
  process.exit(0);
}

const task: Task = tasks[taskId];
const s = spinner();
s.start(`Starting ${task.label}`);
s.stop(task.label);

try {
  await execa(task.command, task.args, { stdio: "inherit", preferLocal: true });
  outro("Done");
} catch (error) {
  const code = (error as { exitCode?: number }).exitCode ?? 1;
  if (code === 130) {
    outro("Stopped");
    process.exit(0);
  }
  cancel(`${task.label} failed`);
  process.exit(code);
}
