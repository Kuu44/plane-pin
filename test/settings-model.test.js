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

test("migrates legacy all-project and all-state settings without narrowing tasks", () => {
  const settings = normalizeStoredSettings({ statusGroup: "started" });
  assert.equal(settings.projectIds, null);
  assert.equal(settings.stateNames, null);
  assert.equal(settings.refreshMinutes, 5);
  assert.equal(settings.theme, "light");
  assert.equal(settings.schemaVersion, 2);
});

test("migrates legacy single-project and selected-state settings", () => {
  const settings = normalizeStoredSettings({
    projectScope: "single",
    projectId: "MKTG",
    stateFilterMode: "selected",
    stateNames: ["In Progress"],
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5"
  });
  assert.deepEqual(settings.assigneeIds, ["94cf0210-9909-4f77-b24e-14b2988156e5"]);
  assert.deepEqual(settings.projectIds, ["MKTG"]);
  assert.deepEqual(settings.stateNames, ["In Progress"]);
});

test("keeps explicit empty selections distinct from select-all", () => {
  const settings = normalizeStoredSettings({
    schemaVersion: 2,
    projectIds: [],
    stateNames: []
  });
  assert.deepEqual(settings.projectIds, []);
  assert.deepEqual(settings.stateNames, []);
});

test("upgrading installs keep running in the tray and keep their roomy cards", () => {
  const upgraded = normalizeStoredSettings({
    schemaVersion: 1,
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    theme: "dark"
  });

  assert.equal(upgraded.compactCards, false, "existing users must not have their task list restyled silently");
  assert.equal(upgraded.closeToTray, true);
  assert.equal(upgraded.minimizeToTray, true);
});

test("the new window preferences round-trip exactly as stored", () => {
  const off = normalizeStoredSettings({ compactCards: true, closeToTray: false, minimizeToTray: false });
  assert.equal(off.compactCards, true);
  assert.equal(off.closeToTray, false);
  assert.equal(off.minimizeToTray, false);
});

test("junk values fall back to the safe default rather than a truthy surprise", () => {
  const junk = normalizeStoredSettings({ compactCards: "yes", closeToTray: 0, minimizeToTray: null });
  assert.equal(junk.compactCards, false, "only a real true enables compact cards");
  assert.equal(junk.closeToTray, true, "only an explicit false disables close-to-tray");
  assert.equal(junk.minimizeToTray, true);
});

test("recovers a decryptable token from backup without replacing newer preferences", () => {
  const loaded = loadStoredSettings([
    { workspaceSlug: "new-workspace", theme: "dark", apiToken: "broken-primary" },
    { workspaceSlug: "old-workspace", apiToken: "valid-backup" }
  ], (encrypted) => {
    if (encrypted === "broken-primary") throw new Error("decrypt failed");
    return "recovered-token";
  });

  assert.equal(loaded.settings.workspaceSlug, "new-workspace");
  assert.equal(loaded.settings.theme, "dark");
  assert.equal(loaded.token, "recovered-token");
  assert.equal(loaded.encryptedToken, "valid-backup");
  assert.equal(loaded.tokenSourceIndex, 1);
  assert.equal(loaded.tokenError, false);
});
