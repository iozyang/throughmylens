import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog } from "../../../scripts/validate-selected-work.mjs";
import { formatPhotoDate, validPhotoDate } from "../components/photography/metadata-date.ts";
import { toPublicPhotograph } from "../components/photography/public-photograph.ts";
import { upgradeRecord } from "../../../scripts/selected-work-record.mjs";

const catalog = JSON.parse(await readFile(new URL("../components/photography/selected-work.json", import.meta.url), "utf8"));
const example = JSON.parse(await readFile(new URL("../components/photography/selected-work.example.json", import.meta.url), "utf8"));
test("new example validates and migration preserves edits without guessing addresses", () => {
  assert.deepEqual(validateCatalog(example), []);
  const legacy = { ...catalog.photos[0], location: { zh: "人工地点", en: "Manual location" }, camera: "DJI FC8482", lens: "Unknown lens" };
  const migrated = upgradeRecord(legacy);
  assert.deepEqual(migrated.location.display, legacy.location);
  assert.equal(migrated.location.city.zh, "");
  assert.deepEqual(migrated.alt, legacy.alt);
  assert.equal(migrated.camera.brand, "DJI");
  assert.equal(migrated.camera.model, "FC8482");
  assert.deepEqual(migrated.lens, { brand: "", model: "Unknown lens" });
  assert.deepEqual(upgradeRecord(migrated), migrated);
});
test("GPS pairs, ranges, provenance, timezones and tags are checked", () => {
  for (const modify of [
    (p) => { p.geo.latitude = 45; },
    (p) => { p.geo = { latitude: 91, longitude: 120, coordinateSystem: "WGS84", source: "manual", precision: "exact" }; },
    (p) => { p.geo.coordinateSystem = "GCJ-02"; },
    (p) => { p.geo.source = "geocoded"; },
    (p) => { p.timezone = "Asia/NotAPlace"; },
    (p) => { p.tags = ["winter", "winter"]; },
    (p) => { p.series = { slug: "Bad Slug", zh: "", en: "" }; },
    (p) => { p.camera = "DJI FC8482"; },
  ]) {
    const invalid = structuredClone(catalog); modify(invalid.photos[0]);
    assert.ok(validateCatalog(invalid).length > 0);
  }
  const valid = structuredClone(catalog);
  valid.photos[0].geo = { latitude: 0, longitude: 0, coordinateSystem: "WGS84", source: "manual", precision: "exact" };
  assert.deepEqual(validateCatalog(valid), []); // Actual zero coordinates are not a missing-value sentinel.
});
test("public projection excludes internal records and leaves the displayed text intact", () => {
  const record = structuredClone(catalog.photos[0]);
  record.location.geocodeQuery = { zh: "PRIVATE-ADDRESS-SENTINEL", en: "" };
  record.location.district.zh = "PRIVATE-DISTRICT-SENTINEL";
  record.geo = { latitude: 45.123456, longitude: 126.987654, coordinateSystem: "WGS84", source: "manual", precision: "exact" };
  const publicPhoto = toPublicPhotograph(record);
  assert.deepEqual(publicPhoto.location, record.location.display);
  assert.deepEqual(publicPhoto.alt, record.alt);
  assert.deepEqual(publicPhoto.title, record.title);
  for (const key of ["geo", "timezone", "camera", "lens", "tags", "series", "description", "file"]) assert.equal(key in publicPhoto, false);
  assert.doesNotMatch(JSON.stringify(publicPhoto), /PRIVATE-|45\.123456|126\.987654|geocodeQuery/);
});
test("editable catalog has complete fields and unique records", () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.doesNotMatch(JSON.stringify(catalog), /:null[,}]/);
  const translated = structuredClone(catalog);
  translated.photos[0].tags = ["风光", "冬季", "landscape"];
  assert.deepEqual(validateCatalog(translated), []);
  translated.photos[0].iso = null;
  assert.ok(validateCatalog(translated).length > 0);
});
test("wrong field names, dates and ISO types identify the offending photograph", () => {
  const invalid = structuredClone(catalog);
  Object.assign(invalid.photos[0], { date: "2025-02-30", iso: "100", loaction: "typo" });
  const errors = validateCatalog(invalid).join("\n");
  assert.match(errors, /1.jpg/); assert.match(errors, /iso/);
  assert.match(errors, /loaction/); assert.match(errors, /calendar date/);
});
test("blank information is permitted; duplicates are rejected", () => {
  const invalid = structuredClone(catalog);
  invalid.photos.push(invalid.photos[0]);
  assert.match(validateCatalog(invalid).join("\n"), /duplicate/);
});
test("date-only and capture-time formatting never shifts the date", () => {
  assert.equal(validPhotoDate("2024-02-29"), true);
  assert.equal(validPhotoDate("2025-02-29"), false);
  assert.equal(formatPhotoDate("2025-02-30", "", "zh"), "时间待补充");
  assert.equal(formatPhotoDate("", "", "en"), "Date not supplied");
  assert.equal(formatPhotoDate("2025-12-03", "13:05:16", "zh"), "2025年12月3日 13:05:16");
  assert.equal(formatPhotoDate("2025-12-03", "", "en"), "December 3, 2025");
});
