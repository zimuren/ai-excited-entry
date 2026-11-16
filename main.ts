// Entry for make.fun "Make the AI judge excited" (ai-excited-01).
// Decodes the bundled image and writes it to /output/entry.png.
// Node 22, stdlib only, ESM, no dependencies, no network.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadImageB64() {
  const candidates = [join(__dirname, "image.b64"), join(process.cwd(), "image.b64")];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      // try next location
    }
  }
  throw new Error("image.b64 not found (looked in script dir and current dir)");
}

const b64 = loadImageB64().replace(/\s+/g, "");
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
