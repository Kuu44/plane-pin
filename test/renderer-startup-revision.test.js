"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const renderer = readFileSync(join(__dirname, "../src/renderer/renderer.js"), "utf8");

function field(value = "") {
  return { value, checked: false, textContent: "", placeholder: "" };
}

function createSaveHarness() {
  const elements = {
    settingsError: field(),
    settingsSaveStatus: field(),
    settingsPlaneUrl: field("https://plane.test/team/"),
    settingsToken: field(),
    settingsMemberOptions: {},
    settingsProjectOptions: {},
    settingsStateOptions: {},
    settingsProfileUrl: field(),
    settingsGroupProject: field(),
    settingsGroupMember: field(),
    settingsChangeOnCheck: field(),
    settingsCompletionSound: field(),
    settingsOnTop: field(),
    settingsCompactCards: field(),
    settingsPriorityGradient: field(),
    settingsStartAtLogin: field(),
    settingsCloseTray: field(),
    settingsMinimizeTray: field(),
    settingsRefreshMinutes: field("5"),
    settingsThemeDark: field()
  };
  elements.settingsOnTop.checked = true;

  const payloads = [];
  let resolveFirstSave;
  let scheduledSaves = 0;
  let sandbox;
  sandbox = {
    elements,
    settingsView: true,
    settings: {
      baseUrl: "https://plane.test",
      workspaceSlug: "team",
      memberId: "member-1",
      memberName: "Kuu",
      startAtLogin: false,
      alwaysOnTop: false,
      tokenSet: true
    },
    settingsDiscovery: null,
    settingsDraftAssigneeIds: [],
    settingsDraftProjectIds: [],
    settingsDraftStateNames: [],
    settingsDraftMemberOrder: [],
    settingsDraftProjectOrder: [],
    settingsDraftStateOrder: [],
    settingsDraftCheckStateMappings: [],
    settingsSaveTimer: undefined,
    settingsSaveInFlight: false,
    settingsSaveAgain: false,
    settingsStartAtLoginRevision: 0,
    settingsStartAtLoginSavedRevision: 0,
    settingsRevision: 0,
    parsePlanePageUrl: () => ({ baseUrl: "https://plane.test", workspaceSlug: "team" }),
    memberIdFromProfile: () => "",
    selectedValues: () => [],
    testSettingsConnection: async () => {},
    scheduleSettingsSave: () => { scheduledSaves += 1; },
    scheduleAutoRefresh: () => {},
    renderCachedTasks: () => {},
    refreshTasks: async () => {},
    applySettingsToShell: ({ preserveStartupDraft = false } = {}) => {
      if (!preserveStartupDraft) elements.settingsStartAtLogin.checked = Boolean(sandbox.settings.startAtLogin);
    },
    window: {
      planePin: {
        saveSettings: (payload) => {
          payloads.push(payload);
          if (payloads.length === 1) {
            return new Promise((resolve) => { resolveFirstSave = resolve; });
          }
          return Promise.resolve();
        },
        getSettings: () => Promise.resolve({
          ...sandbox.settings,
          startAtLogin: payloads.length > 1
        })
      }
    }
  };

  const start = renderer.indexOf("async function saveSettingsForm()");
  const end = renderer.indexOf("\nfunction scheduleSettingsSave", start);
  assert.notEqual(start, -1, "saveSettingsForm should remain available in the renderer source");
  assert.notEqual(end, -1, "saveSettingsForm should end before the settings controls");
  const saveSettingsForm = vm.runInNewContext(`(${renderer.slice(start, end)})`, sandbox);

  return {
    elements,
    payloads,
    saveSettingsForm,
    releaseFirstSave: () => resolveFirstSave(),
    get scheduledSaves() { return scheduledSaves; },
    sandbox
  };
}

test("preserves a newer startup choice across a delayed unrelated settings save", async () => {
  const harness = createSaveHarness();
  const firstSave = harness.saveSettingsForm();

  assert.equal(harness.payloads.length, 1);
  assert.equal(harness.payloads[0].alwaysOnTop, true);
  assert.equal(Object.hasOwn(harness.payloads[0], "startAtLogin"), false);

  harness.elements.settingsStartAtLogin.checked = true;
  harness.sandbox.settingsStartAtLoginRevision += 1;
  harness.sandbox.settingsSaveAgain = true;
  harness.releaseFirstSave();
  await firstSave;

  assert.equal(harness.elements.settingsStartAtLogin.checked, true);
  assert.equal(harness.scheduledSaves, 1);

  await harness.saveSettingsForm();
  assert.equal(harness.payloads.length, 2);
  assert.equal(harness.payloads[1].startAtLogin, true);
  assert.equal(harness.elements.settingsStartAtLogin.checked, true);
});
