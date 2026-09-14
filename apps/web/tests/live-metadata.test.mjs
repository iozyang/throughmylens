import test from "node:test";
import assert from "node:assert/strict";
import { applyLiveMetadata } from "../components/photography/live-metadata.ts";

const photo = { id: "curated", src: "/public.jpg", width: 3000, height: 2000, order: 7,
  title: {zh: "旧标题"}, alt: {zh: "作品"}, location: {zh: "旧地点"},
  focalLength: "12mm", focalLength35mm: "24mm", aperture: "f/2.8", shutterSpeed: "1/60s", iso: 100 };

test("saved metadata updates existing public images without changing identity or publishing drafts", () => {
  const update = {...photo, title:{zh:"新标题",en:""}, location:{zh:"新地点",en:""},
    focalLength35mm:"50mm", aperture:"f/8", shutterSpeed:"1/250s", iso:640,
    src:"/private.jpg", width:1, height:1, order:99, geo:{latitude:30}};
  const result = applyLiveMetadata([photo], [update, {...update, id:"private-draft"}]);
  assert.equal(result.length, 1);
  assert.equal(result[0].focalLength35mm, "50mm");
  assert.equal(result[0].aperture, "f/8");
  assert.equal(result[0].shutterSpeed, "1/250s");
  assert.equal(result[0].iso, 640);
  for (const key of ["id", "src", "width", "height", "order"]) assert.equal(result[0][key], photo[key]);
  assert.equal(result[0].geo, undefined);
  assert.equal(photo.iso, 100);
});

test("explicitly cleared values do not resurrect old static metadata or actual focal length", () => {
  const [result] = applyLiveMetadata([photo], [{...photo, focalLength35mm:"", iso:"", aperture:"", shutterSpeed:""}]);
  assert.equal(result.iso, undefined);
  assert.equal(result.focalLength35mm, "");
  assert.equal(result.aperture, "");
  assert.equal(result.shutterSpeed, "");
  assert.equal(applyLiveMetadata([photo], [])[0], photo);
});
