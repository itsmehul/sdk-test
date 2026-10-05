import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outdir = fileURLToPath(new URL("../dist/lambda", import.meta.url));
await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [fileURLToPath(new URL("../src/lambda.ts", import.meta.url))],
  outfile: `${outdir}/index.mjs`,
  bundle: true,
  minify: true,
  sourcemap: "inline",
  platform: "node",
  target: "node22",
  format: "esm",
  // The Lambda Node.js runtime ships AWS SDK v3.
  external: ["@aws-sdk/*"],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

console.log(`Wrote ${outdir}/index.mjs`);
