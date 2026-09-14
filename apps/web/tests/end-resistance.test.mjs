import test from "node:test";
import assert from "node:assert/strict";
import { atPageEnd, resistanceTarget, stepResistance } from "../components/photography/end-resistance.ts";

test("end feedback only starts at the native page boundary, not native overscroll", () => {
  assert.equal(atPageEnd(100, 3000, 900), false);
  assert.equal(atPageEnd(2099.5, 3000, 900), true);
  assert.equal(atPageEnd(2100, 3000, 900), true);
  assert.equal(atPageEnd(2110, 3000, 900), false);
  assert.equal(atPageEnd(0, 900, 900), false);
});
test("resistance saturates at ten pixels with diminishing input response", () => {
  assert.equal(resistanceTarget(0), 0);
  assert.equal(resistanceTarget(-100), 0);
  assert.ok(resistanceTarget(1000) < 10);
  assert.ok(resistanceTarget(200) - resistanceTarget(100) < resistanceTarget(100));
});
test("critically damped release settles without oscillation at 60 and 120 Hz", () => {
  for (const hz of [60, 120]) {
    let state = {position:0,velocity:0};
    for (let i=0;i<hz;i++) state = stepResistance(state, resistanceTarget(600), 1/hz);
    assert.ok(state.position > 9 && state.position <= 10);
    for (let i=0;i<hz*2;i++) {
      state = stepResistance(state, 0, 1/hz);
      assert.ok(state.position >= 0 && state.position <= 10);
    }
    assert.ok(state.position < .01 && Math.abs(state.velocity) < .03);
  }
});
