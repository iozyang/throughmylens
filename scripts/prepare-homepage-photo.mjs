// Deterministic web derivative. Originals are never modified; EXIF/GPS are not copied.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const requireNext = createRequire(requireWeb.resolve("next/package.json"));
const sharp = requireNext("sharp");
const [input, name] = process.argv.slice(2);
if (!input || !name || !/^[a-z0-9-]+\.jpg$/.test(name)) {
  throw new Error("Usage: node scripts/prepare-homepage-photo.mjs <original> <ascii-name.jpg>");
}
const directory = path.join(root, "apps/web/public/photographs");
const output = path.join(directory, name);
if (path.resolve(input) === output) throw new Error("Cannot overwrite an original.");
await mkdir(directory, { recursive: true });
const result = await sharp(input).rotate()
  .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
  .withIccProfile("srgb")
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(output);
console.log(JSON.stringify({ output, width: result.width, height: result.height, bytes: result.size }));
