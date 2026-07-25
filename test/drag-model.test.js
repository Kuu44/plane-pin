"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDragTracker, defaultThreshold } = require("../src/renderer/drag-model");

test("a press that never moves stays a click", () => {
  const tracker = createDragTracker();
  tracker.start(100, 100);
  assert.equal(tracker.move(101, 101), null);
  assert.equal(tracker.isDragging(), false);
  assert.deepEqual(tracker.end(), { dragged: false });
});

test("movement past the threshold reports the screen delta", () => {
  const tracker = createDragTracker({ threshold: 4 });
  tracker.start(200, 150);
  assert.equal(tracker.move(202, 151), null);
  assert.deepEqual(tracker.move(215, 140), { deltaX: 15, deltaY: -10 });
  assert.equal(tracker.isDragging(), true);
  assert.deepEqual(tracker.end(), { dragged: true });
});

test("deltas stay measured from the press, not from the previous move", () => {
  const tracker = createDragTracker({ threshold: 2 });
  tracker.start(0, 0);
  assert.deepEqual(tracker.move(10, 0), { deltaX: 10, deltaY: 0 });
  assert.deepEqual(tracker.move(30, 5), { deltaX: 30, deltaY: 5 });
  assert.deepEqual(tracker.move(30, 5), { deltaX: 30, deltaY: 5 });
});

test("once dragging, small movements keep reporting instead of falling back to a click", () => {
  const tracker = createDragTracker({ threshold: 5 });
  tracker.start(0, 0);
  tracker.move(0, 20);
  assert.deepEqual(tracker.move(1, 1), { deltaX: 1, deltaY: 1 });
  assert.equal(tracker.isDragging(), true);
});

test("the threshold is a radius, so diagonal drift counts", () => {
  const tracker = createDragTracker({ threshold: 5 });
  tracker.start(0, 0);
  assert.equal(tracker.move(3, 3), null, "3,3 is 4.24 away and stays a click");
  assert.deepEqual(tracker.move(4, 4), { deltaX: 4, deltaY: 4 }, "4,4 is 5.66 away and drags");
});

test("moves are ignored until a press starts one", () => {
  const tracker = createDragTracker();
  assert.equal(tracker.isActive(), false);
  assert.equal(tracker.move(50, 50), null);
});

test("ending resets the tracker so the next press starts clean", () => {
  const tracker = createDragTracker({ threshold: 4 });
  tracker.start(0, 0);
  tracker.move(100, 100);
  assert.deepEqual(tracker.end(), { dragged: true });
  assert.equal(tracker.isActive(), false);

  tracker.start(500, 500);
  assert.equal(tracker.move(501, 500), null);
  assert.deepEqual(tracker.end(), { dragged: false }, "a previous drag must not suppress the next click");
});

test("cancelling abandons the gesture without reporting a drag", () => {
  const tracker = createDragTracker({ threshold: 4 });
  tracker.start(0, 0);
  tracker.move(80, 80);
  tracker.cancel();
  assert.equal(tracker.isActive(), false);
  assert.deepEqual(tracker.end(), { dragged: false });
});

test("non-numeric coordinates are refused rather than moving the window to NaN", () => {
  const tracker = createDragTracker();
  assert.equal(tracker.start(Number.NaN, 10), false);
  assert.equal(tracker.isActive(), false);
  tracker.start(0, 0);
  assert.equal(tracker.move(undefined, 40), null);
  assert.equal(tracker.move("40", 40), null);
});

test("the default threshold is small enough to feel immediate", () => {
  assert.equal(defaultThreshold, 4);
  assert.equal(createDragTracker().threshold, defaultThreshold);
  assert.equal(createDragTracker({ threshold: -1 }).threshold, defaultThreshold);
  assert.equal(createDragTracker({ threshold: 0 }).threshold, 0);
});
