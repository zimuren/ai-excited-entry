// Decode the bundled base64 picture and write it out as entry.png.
//
// The picture lives next to this script as image.b64. This program only
// unwraps that payload, sanity-checks that it really is a JPEG of a sane
// size, and drops the raw bytes into the output directory. It never touches
// the network and never alters a single pixel.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PICTURE_NAME = "image.b64";
const MAX_PICTURE_BYTES = 1024 * 1024; // 1 MiB

// Find the bundled picture: prefer the folder this script lives in, and
// fall back to wherever the command was launched from.
function locateBundledPicture(): string {
  const scriptFolder = dirname(fileURLToPath(import.meta.url));
  const besideScript = join(scriptFolder, PICTURE_NAME);
  if (existsSync(besideScript)) return besideScript;
  const inWorkingDir = resolve(process.cwd(), PICTURE_NAME);
  if (existsSync(inWorkingDir)) return inWorkingDir;
  throw new Error(
    `bundled picture ${PICTURE_NAME} not found next to the script or in the working directory`,
  );
}

// Base64 text may be wrapped at any column, so drop every whitespace
// character before handing it to the decoder.
function decodePayload(text: string): Buffer {
  const compact = text.replace(/\s+/g, "");
  if (compact.length === 0) {
    throw new Error(`bundled picture ${PICTURE_NAME} is empty`);
  }
  return Buffer.from(compact, "base64");
}

// A JPEG must open with SOI (FF D8) and close with EOI (FF D9).
function confirmJpegBookends(bytes: Buffer): void {
  const opensOk = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  const closesOk =
    bytes.length >= 2 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  if (!opensOk || !closesOk) {
    throw new Error("decoded picture is not a complete JPEG (bad SOI/EOI markers)");
  }
}

// Walk the marker stream until the baseline (SOF0) or progressive (SOF2)
// frame header shows up, then read its height and width. The frame header
// layout is: precision (1 byte), height (2 bytes, big-endian), width
// (2 bytes, big-endian).
function readFrameSize(bytes: Buffer): { width: number; height: number } {
  let cursor = 2; // skip the SOI marker
  while (cursor + 1 < bytes.length) {
    if (bytes[cursor] !== 0xff) {
      throw new Error(`invalid JPEG marker at offset ${cursor}`);
    }
    let marker = bytes[cursor + 1];
    // Skip any extra 0xFF padding bytes between markers.
    while (marker === 0xff) {
      cursor += 1;
      marker = bytes[cursor + 1];
    }
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      cursor += 2;
      continue;
    }
    if (cursor + 4 > bytes.length) {
      throw new Error("truncated JPEG marker segment");
    }
    const segmentLength = bytes.readUInt16BE(cursor + 2);
    if (segmentLength < 2 || cursor + 2 + segmentLength > bytes.length) {
      throw new Error("JPEG marker segment overruns the file");
    }
    if (marker === 0xc0 || marker === 0xc2) {
      // Frame header: 2 length bytes, 1 precision byte, then height, width.
      if (segmentLength < 7) {
        throw new Error("JPEG frame header is too short");
      }
      const height = bytes.readUInt16BE(cursor + 5);
      const width = bytes.readUInt16BE(cursor + 7);
      if (width <= 0 || height <= 0) {
        throw new Error(`JPEG frame has invalid dimensions ${width}x${height}`);
      }
      if (width > 1024 || height > 1024) {
        throw new Error(`JPEG frame ${width}x${height} exceeds the 1024 pixel limit`);
      }
      return { width, height };
    }
    cursor += 2 + segmentLength;
  }
  throw new Error("no baseline or progressive JPEG frame header found");
}

function main(): void {
  const picturePath = locateBundledPicture();
  const pictureBytes = decodePayload(readFileSync(picturePath, "utf8"));
  if (pictureBytes.length > MAX_PICTURE_BYTES) {
    throw new Error(
      `decoded picture is ${pictureBytes.length} bytes, over the ${MAX_PICTURE_BYTES} byte limit`,
    );
  }
  confirmJpegBookends(pictureBytes);
  const { width, height } = readFrameSize(pictureBytes);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, pictureBytes);
  console.log(`wrote ${outPath} (${pictureBytes.length} bytes, ${width}x${height})`);
}

main();
