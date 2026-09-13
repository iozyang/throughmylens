import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const folder = new URL("../apps/web/components/photography/", import.meta.url);
const schema = JSON.parse(await readFile(new URL("selected-work.schema.json", folder), "utf8"));

// Small validator for the exact schema features used by this catalog; no new dependencies.
export function validateCatalog(catalog) {
  const errors = [];
  const check = (value, rule, name) => {
    if (rule.$ref) rule = schema.$defs[rule.$ref.split("/").at(-1)];
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    const matches = (type) => type === "null" ? value === null : type === "integer" ? Number.isInteger(value) : type === "number" ? typeof value === "number" && Number.isFinite(value)
      : type === "array" ? Array.isArray(value) : type === "object" ? !!value && typeof value === "object" && !Array.isArray(value) : typeof value === type;
    if (!types.some(matches)) { errors.push(`${name}: expected ${types.join(" or ")}`); return; }
    if (rule.enum && !rule.enum.includes(value)) errors.push(`${name}: invalid choice`);
    if (rule.const !== undefined && value !== rule.const) errors.push(`${name}: must be ${rule.const}`);
    if (value === null) return;
    if (typeof value === "string" && rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${name}: invalid format`);
    if (typeof value === "number" && rule.minimum !== undefined && value < rule.minimum) errors.push(`${name}: below ${rule.minimum}`);
    if (typeof value === "number" && rule.maximum !== undefined && value > rule.maximum) errors.push(`${name}: above ${rule.maximum}`);
    if (rule.minLength && value.length < rule.minLength) errors.push(`${name}: cannot be empty`);
    if (Array.isArray(value) && rule.items) {
      if (value.length < (rule.minItems ?? 0)) errors.push(`${name}: no photographs`);
      if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${name}: duplicate items`);
      value.forEach((item, index) => check(item, rule.items, `${name}[${index}]${item?.file ? ` (${item.file})` : ""}`));
    }
    if (typeof value === "object" && !Array.isArray(value) && rule.properties) {
      for (const key of rule.required ?? []) if (!(key in value)) errors.push(`${name}.${key}: missing field`);
      for (const key of Object.keys(value)) {
        if (Object.hasOwn(rule.properties, key)) check(value[key], rule.properties[key], `${name}.${key}`);
        else if (rule.additionalProperties === false) errors.push(`${name}.${key}: unknown field`);
      }
    }
  };
  check(catalog, schema, "catalog");
  const ids = new Set(), files = new Set();
  for (const photo of Array.isArray(catalog?.photos) ? catalog.photos : []) {
    if (!photo) continue;
    if (ids.has(photo.slug) || files.has(photo.file)) errors.push(`${photo.file}: duplicate slug or filename`);
    ids.add(photo.slug); files.add(photo.file);
    const geo = photo.geo;
    if (geo && typeof geo === "object") {
      const hasLatitude = geo.latitude !== "", hasLongitude = geo.longitude !== "";
      if (hasLatitude !== hasLongitude) errors.push(`${photo.file}.geo: latitude and longitude must be supplied together`);
      if (!hasLatitude && !hasLongitude && (geo.source !== "" || geo.precision !== "")) errors.push(`${photo.file}.geo: no coordinates requires empty source and precision`);
      if (hasLatitude && hasLongitude && (geo.source === "" || geo.precision === "")) errors.push(`${photo.file}.geo: coordinates require source and precision`);
    }
    if (photo.timezone) {
      try { new Intl.DateTimeFormat("en", { timeZone: photo.timezone }); }
      catch { errors.push(`${photo.file}.timezone: invalid IANA time zone`); }
    }
    if (photo.date) {
      const date = new Date(`${photo.date}T00:00:00Z`);
      if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== photo.date) errors.push(`${photo.file}.date: invalid calendar date`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const catalog = JSON.parse(await readFile(new URL("selected-work.json", folder), "utf8"));
    const errors = validateCatalog(catalog);
    if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
    else {
      console.log(`OK: ${catalog.photos.length} photographs. Empty strings are valid missing information.`);
      for (const photo of catalog.photos) {
        const missing = [!photo.location.display.zh && "location.display.zh", ...["date", "time", "timezone", "focalLength", "aperture", "shutterSpeed", "iso"].filter((key) => !photo[key]),
          ...["camera", "lens"].flatMap((key) => ["brand", "model"].filter((field) => !photo[key][field]).map((field) => `${key}.${field}`))].filter(Boolean);
        if (missing.length) console.log(`${photo.file}: missing ${missing.join(", ")}`);
      }
    }
  } catch (error) { console.error(`Catalog could not be read: ${error.message}`); process.exitCode = 1; }
}
