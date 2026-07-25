"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadStoredSettings, normalizeStoredSettings } = require("../src/settings-model");

test("keeps ordinary settings when a saved token cannot be decrypted", () => {
  const loaded = loadStoredSettings({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    projectScope: "all",
    apiToken: "encrypted"
  }, () => {
    throw new Error("decrypt failed");
  });

  assert.equal(loaded.settings.workspaceSlug, "engineering");
  assert.equal(loaded.settings.setupComplete, true);
  assert.equal(loaded.tokenError, true);
  assert.equal(loaded.token, "");
});

test("migrates legacy status settings to the safer all-states filter", () => {
  const settings = normalizeStoredSettings({ statusGroup: "started" });
  assert.equal(settings.stateFilterMode, "all");
  assert.deepEqual(settings.stateNames, []);
});
