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

function jpegDimensions(buf) {
  // Scan JPEG markers for a Start Of Frame (SOF0/SOF2) segment and read
  // height then width (big-endian) after its length + precision bytes.
  let pos = 2; // skip SOI (FF D8)
  while (pos + 9 <= buf.length) {
    if (buf[pos] !== 0xff) {
      throw new Error("malformed JPEG marker stream");
    }
    // Skip any fill bytes (extra FF) before the marker code.
    let marker = buf[pos + 1];
    while (marker === 0xff) {
      pos += 1;
      marker = buf[pos + 1];
    }
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    const len = buf.readUInt16BE(pos + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      // SOF segment: length (2), precision (1), height (2), width (2).
      const height = buf.readUInt16BE(pos + 5);
      const width = buf.readUInt16BE(pos + 7);
      return { width, height };
    }
    pos += 2 + len;
  }
  throw new Error("no SOF0/SOF2 marker found in JPEG");
}

const dims = jpegDimensions(bytes);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, bytes);
console.log(`wrote ${outPath} (${bytes.length} bytes, ${dims.width}x${dims.height})`);
