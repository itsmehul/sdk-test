import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createApp, echoEngine, openAPIConfig } from "../src/app";

const target = fileURLToPath(new URL("../../../openapi/openapi.json", import.meta.url));
const spec = createApp({ apiKey: "spec-export", engine: echoEngine }).getOpenAPI31Document(
  openAPIConfig,
);

await writeFile(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${target}`);
