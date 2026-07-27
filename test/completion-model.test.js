"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  defaultStateMappings,
  shouldCelebrateTransition,
  targetForState
} = require("../src/renderer/completion-model");

test("defaults task checks to the next ordered workflow state", () => {
  const states = ["Backlog", "Todo", "In Progress", "In Review", "Done"].map((name) => ({ name }));
  const mappings = defaultStateMappings(states, states.map((state) => state.name));

  assert.equal(targetForState(mappings, "Backlog"), "Todo");
  assert.equal(targetForState(mappings, "In Progress"), "In Review");
  assert.equal(targetForState(mappings, "Done"), "");
});

test("celebrates review and completed transitions only", () => {
  assert.equal(shouldCelebrateTransition({ stateName: "In Review", stateGroup: "started" }), true);
  assert.equal(shouldCelebrateTransition({ stateName: "Released", stateGroup: "completed" }), true);
  assert.equal(shouldCelebrateTransition({ stateName: "In Progress", stateGroup: "started" }), false);
});
