"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

test("onboarding and settings ask for the workspace home address", () => {
  const html = readFileSync(join(__dirname, "../src/renderer/index.html"), "utf8");
  const renderer = readFileSync(join(__dirname, "../src/renderer/renderer.js"), "utf8");
  const main = readFileSync(join(__dirname, "../src/main.js"), "utf8");

  assert.equal((html.match(/Workspace home address/g) || []).length, 2);
  assert.match(html, /Go to that workspace.+Home/);
  assert.match(html, /https:\/\/plane\.example\.com\/my-workspace\//);
  assert.match(renderer, /workspace home address, including the workspace name/);
  assert.match(main, /Workspace home address, account, and API token are required/);
  assert.doesNotMatch(html, /Start from any Plane page/);
});
