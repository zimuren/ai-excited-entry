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

const b64 = readBase64().trim();
if (!b64) {
  throw new Error("image.b64 is empty");
}
const bytes = Buffer.from(b64, "base64");
if (
  bytes.length < 4 ||
  bytes[0] !== 0xff ||
  bytes[1] !== 0xd8 ||
  bytes[bytes.length - 2] !== 0xff ||
  bytes[bytes.length - 1] !== 0xd9
) {
  throw new Error("decoded image.b64 is not a JPEG (must start with FF D8 and end with FF D9)");
}
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, bytes);
console.log(`wrote ${outPath} (${bytes.length} bytes)`);
