import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function readBase64() {
  for (const dir of [scriptDir, process.cwd()]) {
    try {
      return readFileSync(join(dir, "image.b64"), "utf8");
    } catch {
      // try next location
    }
  }
  throw new Error("image.b64 not found next to main.ts or in the working directory");
}

const bytes = Buffer.from(readBase64().trim(), "base64");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, bytes);
console.log(`wrote ${outPath} (${bytes.length} bytes)`);
