import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoGesture } from "../components/photography/photo-gesture.ts";
import { localize } from "../components/photography/types.ts";

test("touch releases metadata without waiting for a browser click, exactly once", () => {
  const gesture = new PhotoGesture();
  for (let tap = 0; tap < 3; tap++) {
    gesture.start(50, 50, true, () => assert.fail("Not a hold"));
    assert.equal(gesture.release(), "metadata");
    gesture.leave();
    assert.equal(gesture.click(false), "none");
    assert.equal(gesture.release(), "none");
  }
});

test("pointerup never toggles metadata after a swipe, cancel or hold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const action of ["swipe", "cancel", "hold"]) {
    const gesture = new PhotoGesture();
    gesture.start(50, 50, true, () => {});
    if (action === "swipe") gesture.move(80, 50);
    if (action === "cancel") gesture.cancel();
    if (action === "hold") t.mock.timers.tick(500);
    assert.equal(gesture.release(), "none");
  }
});

test("mouse pointerup leaves normal click and keyboard activation intact", () => {
  const gesture = new PhotoGesture();
  gesture.start(50, 50, false, () => {});
  assert.equal(gesture.release(), "none");
  assert.equal(gesture.click(false), "fullscreen");
  assert.equal(gesture.click(true), "fullscreen");
});

test("short touch toggles metadata, not fullscreen", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  gesture.start(50, 50, true, () => opened++);
  t.mock.timers.tick(150); gesture.finish(); t.mock.timers.tick(500);
  assert.equal(gesture.click(false), "metadata"); assert.equal(opened, 0);
});

test("touch pointerleave after pointerup must not consume a normal tap", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  for (let tap = 0; tap < 2; tap++) {
    gesture.start(50, 50, true, () => opened++);
    t.mock.timers.tick(100); gesture.finish(); gesture.leave();
    assert.equal(gesture.click(false), "metadata");
  }
  t.mock.timers.tick(600); assert.equal(opened, 0);
});

test("leaving while a finger is still held cancels the hold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  gesture.start(50, 50, true, () => opened++); gesture.leave();
  t.mock.timers.tick(600);
  assert.equal(gesture.click(false), "none"); assert.equal(opened, 0);
});

test("long press opens exactly once at 450ms and consumes the following click", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  gesture.start(50, 50, true, () => opened++);
  t.mock.timers.tick(449); assert.equal(opened, 0);
  t.mock.timers.tick(1); assert.equal(opened, 1);
  gesture.finish(); t.mock.timers.tick(1000);
  assert.equal(opened, 1); assert.equal(gesture.click(false), "none");
});

test("swiping in either direction cancels the hold and the click", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const [x, y] of [[61, 50], [50, 61]]) {
    const gesture = new PhotoGesture(); let opened = 0;
    gesture.start(50, 50, true, () => opened++);
    assert.equal(gesture.move(x, y), true); t.mock.timers.tick(1000);
    assert.equal(opened, 0); assert.equal(gesture.click(false), "none");
  }
});

test("small finger jitter retains the hold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  gesture.start(50, 50, true, () => opened++);
  assert.equal(gesture.move(53, 53), false); t.mock.timers.tick(450);
  assert.equal(opened, 1);
});

test("pointer cancellation/unmount leaves no pending callback; next tap is fresh", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gesture = new PhotoGesture(); let opened = 0;
  gesture.start(50, 50, true, () => opened++); gesture.cancel(); t.mock.timers.tick(500);
  assert.equal(opened, 0); assert.equal(gesture.click(false), "none");
  gesture.start(50, 50, true, () => opened++); gesture.finish();
  assert.equal(gesture.click(false), "metadata");
});

test("mouse click and keyboard activation open fullscreen; drag does not", () => {
  const gesture = new PhotoGesture();
  gesture.start(50, 50, false, () => assert.fail("Mouse must not trigger long press"));
  gesture.finish(); assert.equal(gesture.click(false), "fullscreen");
  gesture.start(50, 50, false, () => {}); gesture.move(70, 50); gesture.finish();
  assert.equal(gesture.click(false), "none"); assert.equal(gesture.click(true), "fullscreen");
});

test("empty/missing English falls back independently to Chinese", () => {
  assert.equal(localize({ zh: "晚霞" }, "en"), "晚霞");
  assert.equal(localize({ zh: "晚霞", en: " " }, "en"), "晚霞");
  assert.equal(localize({ zh: "晚霞", en: "Evening light" }, "en"), "Evening light");
  assert.equal(localize({ zh: "晚霞", en: "Evening light" }, "zh"), "晚霞");
});
