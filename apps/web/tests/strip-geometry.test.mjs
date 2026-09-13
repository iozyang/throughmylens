import { test } from "node:test";
import assert from "node:assert/strict";
import { rebaseStripPosition, resizeStripPosition } from "../components/photography/strip-geometry.ts";

test("continuous manual swipes recycle for thousands of crossings in both directions", () => {
  const width = 1500;
  for (const delta of [-370, 370]) {
    let position = width;
    for (let step = 0; step < 10000; step++) {
      const intended = position + delta;
      position = rebaseStripPosition(intended, width);
      assert.ok(position >= width * .5 && position < width * 2);
      assert.equal(((position - intended) % width + width) % width, 0);
    }
  }
});

test("central copy keeps its exact position, including fractional pixels", () => {
  assert.equal(rebaseStripPosition(1743.25, 1581.5), 1743.25);
  assert.equal(rebaseStripPosition(2372.25, 1581.5), 2372.25);
});

test("right and left loop crossings preserve the same visual phase", () => {
  assert.equal(rebaseStripPosition(3200, 1500), 1700);
  assert.equal(rebaseStripPosition(200, 1500), 1700);
  assert.equal(rebaseStripPosition(3000, 1500), 1500);
});

test("fractional sequence widths and Safari negative overscroll are safe", () => {
  const width = 1581.520874;
  assert.ok(Math.abs(rebaseStripPosition(width * 2 + 100, width) - (width + 100)) < .00001);
  assert.equal(rebaseStripPosition(-20, 1500), 2980);
  assert.equal(rebaseStripPosition(25, 0), 25);
});

test("resize preserves photograph offset instead of resetting to the start", () => {
  assert.equal(resizeStripPosition(0, 0, 1500), 1500);
  assert.equal(resizeStripPosition(1750, 1500, 3000), 3500);
  assert.equal(resizeStripPosition(1750, 1500, 1500), 1750);
  assert.equal(resizeStripPosition(1750, 1500, 0), 1750);
});
