import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { cancel, intro, isCancel, log, outro, select, spinner } from "@clack/prompts";
import { execa } from "execa";
import pc from "picocolors";

type Step = { command: string; args: string[] } | { run: () => Promise<void> };
type Task = Step & { label: string; hint: string; before?: Step[] };

const REGISTRY_HOST = "npm.pkg.github.com";
const buildPackages: Step = { command: "turbo", args: ["run", "build", "--filter=./packages/*"] };

async function storeRegistryToken() {
  const { stdout: token } = await execa("gh", ["auth", "token"]);
  await execa("npm", ["config", "set", `//${REGISTRY_HOST}/:_authToken`, token]);
}

async function publishPreview() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const manifests = readdirSync("packages")
    .map((dir) => join("packages", dir, "package.json"))
    .filter((file) => existsSync(file));
  const originals = new Map(manifests.map((file) => [file, readFileSync(file, "utf8")]));
  try {
    for (const [file, text] of originals) {
      const { version } = JSON.parse(text) as { version: string };
      writeFileSync(
        file,
        text.replace(`"version": "${version}"`, `"version": "${version}-preview.${stamp}"`),
      );
    }
    await execa(
      "pnpm",
      ["-r", "--filter=./packages/*", "publish", "--tag", "preview", "--no-git-checks"],
      { stdio: "inherit" },
    );
  } finally {
    for (const [file, text] of originals) writeFileSync(file, text);
  }
}

function hasRegistryToken(): boolean {
  const npmrc = join(homedir(), ".npmrc");
  return (
    existsSync(npmrc) && readFileSync(npmrc, "utf8").includes(`//${REGISTRY_HOST}/:_authToken`)
  );
}

const example = (file: string): string[] => ["--env-file-if-exists=.env", `examples/src/${file}`];
const uv = (...args: string[]): string[] => ["run", "--directory", "python", ...args];
const TF_DIR = "infra/terraform/envs/prod";
const terraform = (...args: string[]): string[] => [`-chdir=${TF_DIR}`, ...args];
const bundleLambda: Step = { command: "pnpm", args: ["--filter", "@rightpeople/api", "bundle"] };
const pyExample = (file: string): string[] => [
  "run",
  "--project",
  "python",
  "--env-file",
  ".env",
  "python",
  `examples/python/${file}`,
];

const tasks = {
  codegen: {
    label: "Generate spec and SDK types",
    hint: "apps/api → openapi/openapi.json → TS types + Python models",
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
    label: "@itsmehul/sdk",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("sdk.ts"),
  },
  exampleAiSdk: {
    label: "@itsmehul/ai-sdk-provider",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("ai-sdk.ts"),
  },
  exampleLangchain: {
    label: "@itsmehul/langchain",
    hint: "Needs `pnpm dev` running and a build",
    command: "tsx",
    args: example("langchain.ts"),
  },
  exampleSdkPy: {
    label: "rightpeople (Python)",
    hint: "Needs `pnpm dev` running",
    command: "uv",
    args: pyExample("sdk.py"),
  },
  exampleLangchainPy: {
    label: "langchain-rightpeople (Python)",
    hint: "Needs `pnpm dev` running",
    command: "uv",
    args: pyExample("langchain.py"),
  },
  pySync: {
    label: "Install Python deps",
    hint: "uv sync",
    command: "uv",
    args: ["sync", "--directory", "python"],
  },
  pyTest: {
    label: "Test",
    hint: "pytest against the reference API",
    command: "uv",
    args: uv("pytest"),
  },
  pyTypecheck: {
    label: "Typecheck",
    hint: "pyright strict",
    command: "uv",
    args: uv("pyright"),
  },
  pyLint: {
    label: "Lint",
    hint: "ruff check",
    command: "uv",
    args: uv("ruff", "check", "."),
  },
  pyFormat: {
    label: "Format",
    hint: "ruff format",
    command: "uv",
    args: uv("ruff", "format", "."),
  },
  pyBuild: {
    label: "Build wheels",
    hint: "uv build → python/dist",
    command: "uv",
    args: ["build", "--directory", "python", "--all-packages", "--out-dir", "dist"],
  },
  bundle: {
    label: "Bundle Lambda",
    hint: "apps/api → apps/api/dist/lambda/index.mjs",
    ...bundleLambda,
  },
  tfInit: {
    label: "Terraform init",
    hint: `S3 state from ${TF_DIR}/backend.hcl`,
    command: "terraform",
    args: terraform("init", "-backend-config=backend.hcl"),
  },
  tfPlan: {
    label: "Plan",
    hint: "Bundle Lambda, then terraform plan",
    command: "terraform",
    args: terraform("plan"),
    before: [bundleLambda],
  },
  tfApply: {
    label: "Deploy",
    hint: "Bundle Lambda, then terraform apply",
    command: "terraform",
    args: terraform("apply"),
    before: [bundleLambda],
  },
  tfOutput: {
    label: "Outputs",
    hint: "API URL, GPU group, model bucket (`terraform output -raw api_key` for the key)",
    command: "terraform",
    args: terraform("output"),
  },
  tfDestroy: {
    label: "Destroy",
    hint: "Tear down all production infrastructure",
    command: "terraform",
    args: terraform("destroy"),
    before: [bundleLambda],
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
  registryLogin: {
    label: "Log in to GitHub Packages",
    hint: `gh auth with package scopes → ~/.npmrc token for ${REGISTRY_HOST}`,
    run: storeRegistryToken,
    before: [
      {
        command: "gh",
        args: [
          "auth",
          "login",
          "--hostname",
          "github.com",
          "--web",
          "--scopes",
          "write:packages,read:packages",
        ],
      },
    ],
  },
  publishPreview: {
    label: "Publish preview",
    hint: "Build, then publish x.y.z-preview.<timestamp> under the `preview` tag",
    run: publishPreview,
    before: [buildPackages],
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
    tasks: ["exampleSdk", "exampleAiSdk", "exampleLangchain", "exampleSdkPy", "exampleLangchainPy"],
  },
  {
    label: "Python",
    hint: "uv workspace in python/",
    tasks: ["pySync", "pyTest", "pyTypecheck", "pyLint", "pyFormat", "pyBuild"],
  },
  {
    label: "Deploy",
    hint: "AWS Lambda + spot inference instance via Terraform",
    tasks: ["bundle", "tfInit", "tfPlan", "tfApply", "tfOutput", "tfDestroy"],
  },
  {
    label: "Release",
    hint: "Changesets and GitHub Packages",
    tasks: ["changeset", "changesetStatus", "version", "registryLogin", "publishPreview"],
  },
];

function check(label: string, ok: boolean, missing: string) {
  log.info(`${label}: ${ok ? pc.green("ok") : pc.yellow(missing)}`);
}

console.clear();
intro(pc.bgCyan(pc.black(" rightpeople sdk ")));

try {
  loadEnvFile();
} catch {}

check(".env", existsSync(".env"), "missing (copy .env.example)");
check("RIGHTPEOPLE_API_KEY", Boolean(process.env.RIGHTPEOPLE_API_KEY), "not set");
check("OpenAPI spec", existsSync("openapi/openapi.json"), "missing (run codegen)");
check("SDK types", existsSync("packages/sdk/src/generated/schema.d.ts"), "missing (run codegen)");
check("Build output", existsSync("packages/sdk/dist/index.mjs"), "missing (run build)");
check(
  "Python models",
  existsSync("python/rightpeople/src/rightpeople/_generated/models.py"),
  "missing (run codegen)",
);
check("Python venv", existsSync("python/.venv"), "missing (Python → Install Python deps)");
check("GitHub Packages token", hasRegistryToken(), "missing (Release → Log in to GitHub Packages)");
check(
  "Terraform backend",
  existsSync(`${TF_DIR}/backend.hcl`),
  "missing (copy backend.hcl.example)",
);

const groupIndex = await select({
  message: "Group",
  options: groups.map((group, value) => ({ value, label: group.label, hint: group.hint })),
});
if (isCancel(groupIndex)) {
  cancel("Cancelled");
  process.exit(0);
}

const taskId = await select<string>({
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

const task: Task = tasks[taskId as TaskId];
const s = spinner();
s.start(`Starting ${task.label}`);
s.stop(task.label);

try {
  for (const step of [...(task.before ?? []), task]) {
    if ("run" in step) await step.run();
    else await execa(step.command, step.args, { stdio: "inherit", preferLocal: true });
  }
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
