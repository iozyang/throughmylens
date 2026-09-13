import test from "node:test";
import assert from "node:assert/strict";
import { latestCoverPhotos } from "../app/admin/album-cover.ts";
import { galleryColumns, imageSizes, flipTransform } from "../app/admin/gallery-geometry.ts";
import { applyTranslations } from "../app/admin/translation-fields.ts";

test("covers use latest upload, not exposure date or manual order; do not mutate", () => {
  const photos = Array.from({length: 6}, (_, i) => ({ id: String(i), created_at: `2026-09-${10+i}T00:00:00Z`, order: 6-i }));
  assert.deepEqual(latestCoverPhotos(photos, 4).map(p => p.id), ["5", "4", "3", "2"]);
  assert.deepEqual(latestCoverPhotos(photos).map(p => p.id), ["5"]);
  assert.equal(photos[0].id, "0");
});
test("five modes keep existing columns and responsive gutter rules", () => {
  assert.deepEqual([...galleryColumns], [16, 8, 4, 3, 1]);
  assert.match(imageSizes(2), /22px\) \/ 4/);
  assert.match(imageSizes(4), /1100px/);
  assert.equal(flipTransform({left: 10, top: 20, width: 100, height: 100}, {left: 0, top: 10, width: 200, height: 200}), "translate(10px, 10px) scale(0.5, 0.5)");
});
test("translation never overwrites manual English or changed Chinese", () => {
  const pair = () => ({zh: "中文", en: ""});
  const original = { title: pair(), alt: pair(), description: pair(), series: {...pair(), slug: "test"}, location: Object.fromEntries(["place", "district", "city", "region", "country", "geocodeQuery"].map(k=>[k,pair()])) };
  const current = structuredClone(original);
  current.alt.en = "Manual"; current.description.zh = "新中文";
  const result = applyTranslations(current, original, {title: "Title", alt: "AI", description: "Old text", "geo.latitude": "bad"});
  assert.deepEqual(result.applied, ["title"]);
  assert.equal(result.record.alt.en, "Manual");
  assert.equal(result.record.description.en, "");
  assert.equal(original.title.en, "");
});
