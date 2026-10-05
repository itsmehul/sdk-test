import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: true,
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
});
