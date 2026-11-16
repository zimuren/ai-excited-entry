// make.fun entry — "Make the AI judge excited" (ai-excited-01).
// Takes the base64 picture shipped next to this script, turns it back into
// bytes, and drops the result at $MAKEFUN_OUTPUT_DIR/entry.png
// (or /output/entry.png when the variable is unset).
// Runs on Node 22+, standard library only, ESM, no dependencies, no network.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The picture lives in image.b64, either beside this file or in the folder
// the command was launched from; the first copy found wins.
function fetchEncodedPicture() {
  const places = [join(here, "image.b64"), join(process.cwd(), "image.b64")];
  for (const place of places) {
    try {
      return readFileSync(place, "utf8");
    } catch {
      continue;
    }
  }
  throw new Error("image.b64 not found (looked in script dir and current dir)");
}

// Base64 may be wrapped across lines, so all whitespace comes out first.
function decodePicture() {
  const text = fetchEncodedPicture().replace(/\s+/g, "");
  if (text.length === 0) {
    throw new Error("image.b64 is empty");
  }
  return Buffer.from(text, "base64");
}

// A JPEG always opens with FF D8 and closes with FF D9; anything else
// means the bundled data is not a JPEG at all.
function checkJpegBookends(buf) {
  const ok =
    buf.length >= 4 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[buf.length - 2] === 0xff &&
    buf[buf.length - 1] === 0xd9;
  if (!ok) {
    throw new Error("decoded image.b64 is not a JPEG (must start with FF D8 and end with FF D9)");
  }
}

// Markers with no payload of their own: TEM (0x01) and the RSTn / SOI / EOI
// range. Everything else carries a 2-byte length field right after the code.
function isPayloadFree(code) {
  return code === 0x01 || (code >= 0xd0 && code <= 0xd9);
}

// Walk the marker stream past the SOI header until a Start Of Frame
// segment (baseline SOF0 or progressive SOF2) shows up; its payload holds
// one precision byte, then height, then width, all big-endian.
function measureFrame(buf) {
  let cursor = 2;
  while (cursor + 9 <= buf.length) {
    if (buf[cursor] !== 0xff) {
      throw new Error("malformed JPEG marker stream");
    }
    let code = buf[cursor + 1];
    while (code === 0xff) {
      cursor += 1;
      code = buf[cursor + 1];
    }
    if (isPayloadFree(code)) {
      cursor += 2;
      continue;
    }
    const segmentLen = buf.readUInt16BE(cursor + 2);
    if (code === 0xc0 || code === 0xc2) {
      const height = buf.readUInt16BE(cursor + 5);
      const width = buf.readUInt16BE(cursor + 7);
      if (width === 0 || height === 0) {
        throw new Error(`JPEG frame has invalid dimensions ${width}x${height} (both must be positive)`);
      }
      return { width, height };
    }
    cursor += 2 + segmentLen;
  }
  throw new Error("no SOF0/SOF2 marker found in JPEG");
}

const picture = decodePicture();
checkJpegBookends(picture);
const size = measureFrame(picture);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, picture);
console.log(`wrote ${outPath} (${picture.length} bytes, ${size.width}x${size.height})`);
