// One-time asset preparation for the homepage "Selected Work" strip.
// Reads EXIF from selected_work/*.jpg via ExifTool, writes optimized web
// derivatives into apps/web/public/photographs/selected-work/ and an
// auto-generated metadata base into apps/web/components/photography/.
// Manual edits now belong in selected-work.json. Existing editable entries are
// preserved on re-scan; the legacy overrides file is used only when seeding.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upgradeRecord } from "./selected-work-record.mjs";
import { validateCatalog } from "./validate-selected-work.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const sharp = createRequire(requireWeb.resolve("next/package.json"))("sharp");

const sourceDir = path.join(root, "selected_work");
const outputDir = path.join(root, "apps/web/public/photographs/selected-work");
const basePath = path.join(root, "apps/web/components/photography/selected-work.exif.json");
const editablePath = path.join(root, "apps/web/components/photography/selected-work.json");
const previous = await readFile(editablePath, "utf8").then(JSON.parse).catch((error) => {
  if (error.code === "ENOENT") return { photos: [] };
  throw error; // Never overwrite a hand-edited file with invalid JSON.
});
const overrides = JSON.parse(await readFile(path.join(path.dirname(basePath), "selected-work.overrides.json"), "utf8"));
if (previous.photos.length) {
  const errors = validateCatalog(previous);
  if (errors.length) throw new Error(errors.join("\n"));
}
const existingByFile = new Map(previous.photos.map((photo) => [photo.file, photo]));

await mkdir(outputDir, { recursive: true });

const natural = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const files = (await readdir(sourceDir))
  .filter((name) => /\.jpe?g$/i.test(name))
  .sort(natural.compare);

// Stable ASCII slug derived from the filename so re-runs keep the same id.
const slugFor = (name) => {
  const base = path.parse(name).name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base || "photo";
};

// Non-ASCII filenames are passed through a UTF-8 argument file so Windows
// command-line encoding never truncates ExifTool reads. Private GPS is not
// requested; only display metadata is extracted.
const exiftool = process.env.EXIFTOOL_PATH || "exiftool";
const argfile = path.join(await mkdtemp(path.join(os.tmpdir(), "exif-selected-")), "args.txt");
await writeFile(argfile, ["--", ...files.map((file) => path.join(sourceDir, file))].join("\n") + "\n", "utf8");
let raw;
try {
  raw = JSON.parse(execFileSync(exiftool, [
    "-j", "-G1", "-n",
    "-File:FileName",
    "-IFD0:Make", "-IFD0:Model",
    "-ExifIFD:LensMake", "-ExifIFD:LensModel", "-Composite:LensID",
    "-ExifIFD:FocalLength", "-ExifIFD:FocalLengthIn35mmFormat", "-Composite:FocalLength35efl",
    "-ExifIFD:FNumber", "-ExifIFD:ISO", "-ExifIFD:ExposureTime",
    "-ExifIFD:DateTimeOriginal",
    "-IPTC:Sub-location", "-IPTC:City", "-IPTC:Province-State", "-IPTC:Country-PrimaryLocationName",
    "-XMP-photoshop:City", "-XMP-photoshop:State", "-XMP-photoshop:Country", "-XMP-iptcCore:Location",
    "-@", argfile,
  ], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }));
} finally {
  await rm(path.dirname(argfile), { recursive: true, force: true });
}
const exifByName = new Map(raw.map((entry) => [entry["System:FileName"] ?? entry["File:FileName"] ?? path.basename(entry.SourceFile), entry]));

const first = (entry, ...names) => {
  for (const name of names) {
    const value = entry?.[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const formatDate = (value) => {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

const formatFocal = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;
  const rounded = Math.round(number);
  const text = Math.abs(number - rounded) < 1e-9 ? String(rounded) : number.toFixed(2).replace(/\.?0+$/, "");
  return `${text}mm`;
};

const formatAperture = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;
  const tenth = Math.round(number * 10) / 10;
  const text = Math.abs(number - tenth) < 1e-9 ? String(tenth) : String(number);
  return `f/${text}`;
};

const formatShutter = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (seconds >= 1) {
    const whole = Math.round(seconds);
    return Math.abs(seconds - whole) < 1e-6 ? `${whole}s` : `${seconds}s`;
  }
  const denominator = Math.round(1 / seconds);
  if (Math.abs(seconds - 1 / denominator) <= 1e-6 * Math.max(1, seconds)) return `1/${denominator}s`;
  return `${seconds}s`;
};

const records = [];
const used = new Set(previous.photos.map((photo) => photo.slug));
for (const file of files) {
  const entry = exifByName.get(file) || {};
  const existing = existingByFile.get(file);
  let slug = existing?.slug ?? slugFor(file);
  if (!existing && used.has(slug)) {
    let suffix = 2;
    while (used.has(`${slug}-${suffix}`)) suffix += 1;
    slug = `${slug}-${suffix}`;
  }
  used.add(slug);

  const source = path.join(sourceDir, file);
  const output = path.join(outputDir, existing ? path.basename(existing.src) : `${slug}.jpg`);
  const [sourceStat, outputStat] = await Promise.all([stat(source), stat(output).catch(() => null)]);
  let width;
  let height;
  if (outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs) {
    ({ width, height } = await sharp(output).metadata());
  } else {
    const info = await sharp(source).rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .withIccProfile("srgb")
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toFile(output);
    ({ width, height } = info);
  }

  const focal35 = first(entry, "ExifIFD:FocalLengthIn35mmFormat", "Composite:FocalLength35efl");
  const focal = first(entry, "ExifIFD:FocalLength");
  const camera = { brand: entry["IFD0:Make"] ?? "", model: entry["IFD0:Model"] ?? "" };
  const lens = first(entry, "ExifIFD:LensModel", "Composite:LensID");
  const localized = (value = "") => ({ zh: value, en: "" });
  const locationParts = [
    first(entry, "IPTC:Sub-location", "XMP-iptcCore:Location"),
    first(entry, "IPTC:City", "XMP-photoshop:City"),
    first(entry, "IPTC:Province-State", "XMP-photoshop:State"),
    first(entry, "IPTC:Country-PrimaryLocationName", "XMP-photoshop:Country"),
  ];

  records.push({
    slug,
    file,
    src: existing?.src ?? `/photographs/selected-work/${slug}.jpg`,
    width,
    height,
    date: formatDate(entry["ExifIFD:DateTimeOriginal"]),
    time: entry["ExifIFD:DateTimeOriginal"]?.match(/\d{4}:\d{2}:\d{2} (\d{2}:\d{2}:\d{2})/)?.[1],
    location: {
      place: localized(locationParts[0]), district: localized(), city: localized(locationParts[1]),
      region: localized(locationParts[2]), country: localized(locationParts[3]), countryCode: "",
      display: localized(locationParts.filter(Boolean).join("，")), geocodeQuery: localized(),
    },
    focalLength: formatFocal(focal),
    focalLength35mm: formatFocal(focal35),
    aperture: formatAperture(entry["ExifIFD:FNumber"]),
    shutterSpeed: formatShutter(entry["ExifIFD:ExposureTime"]),
    iso: Number.isFinite(Number(entry["ExifIFD:ISO"])) ? Number(entry["ExifIFD:ISO"]) : undefined,
    camera,
    lens: { brand: entry["ExifIFD:LensMake"] ?? "", model: lens && lens !== "0.0 mm f/0.0" ? lens : "" },
  });
}

await writeFile(basePath, JSON.stringify(records, null, 2) + "\n", "utf8");
// One editable source of truth. Existing entries are never re-seeded: blanks
// are intentional too. New photographs get a complete, fill-in-ready record.
const byFile = new Map(previous.photos.map((photo) => [photo.file, photo]));
const editable = records.map((record, order) => byFile.get(record.file) ?? upgradeRecord({
  ...record, order, alt: { zh: `摄影作品 ${record.file}`, en: "" },
  ...overrides[record.slug],
}));
const removed = previous.photos.filter((photo) => !records.some((record) => record.file === photo.file));
if (removed.length) throw new Error("Source photos were removed; reconcile selected-work.json manually. Editorial metadata was not overwritten.");
const errors = validateCatalog({ photos: editable });
if (errors.length) throw new Error(errors.join("\n"));
await writeFile(editablePath, JSON.stringify({ $schema: "./selected-work.schema.json", photos: editable }, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ images: records.length, outputDir, basePath }, null, 2));
