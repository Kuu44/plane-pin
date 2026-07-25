"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTrayMenuTemplate, trayLocationName, trayTooltip } = require("../src/tray-menu");

const byId = (template, id) => template.find((item) => item.id === id);

test("the tray menu always offers a real exit", () => {
  for (const platform of ["win32", "darwin", "linux"]) {
    const quit = byId(buildTrayMenuTemplate({ platform }), "quit");
    assert.equal(quit.type, "normal");
    assert.match(quit.label, /Plane Pin$/);
  }
});

test("exit is named the way each platform names it", () => {
  assert.equal(byId(buildTrayMenuTemplate({ platform: "darwin" }), "quit").label, "Quit Plane Pin");
  assert.equal(byId(buildTrayMenuTemplate({ platform: "win32" }), "quit").label, "Exit Plane Pin");
  assert.equal(byId(buildTrayMenuTemplate({ platform: "linux" }), "quit").label, "Exit Plane Pin");
});

test("the show entry reflects whether the window is on screen", () => {
  assert.equal(byId(buildTrayMenuTemplate({ windowVisible: false }), "show").label, "Show Plane Pin");
  assert.equal(byId(buildTrayMenuTemplate({ windowVisible: true }), "show").label, "Hide Plane Pin");
});

test("checkbox entries mirror the stored preferences", () => {
  const template = buildTrayMenuTemplate({ alwaysOnTop: true, compactCards: false });
  assert.equal(byId(template, "always-on-top").type, "checkbox");
  assert.equal(byId(template, "always-on-top").checked, true);
  assert.equal(byId(template, "compact-cards").type, "checkbox");
  assert.equal(byId(template, "compact-cards").checked, false);
});

test("refresh is disabled until a token is loaded", () => {
  assert.equal(byId(buildTrayMenuTemplate({ connected: false }), "refresh").enabled, false);
  assert.equal(byId(buildTrayMenuTemplate({ connected: true }), "refresh").enabled, true);
  assert.equal(byId(buildTrayMenuTemplate({}), "refresh").enabled, true);
});

test("every entry carries an id the click handler can route on", () => {
  const ids = buildTrayMenuTemplate({})
    .filter((item) => item.type !== "separator")
    .map((item) => item.id);
  assert.deepEqual(ids, ["show", "refresh", "always-on-top", "compact-cards", "settings", "quit"]);
  assert.equal(new Set(ids).size, ids.length);
});

test("the tray is named after the surface each platform actually uses", () => {
  assert.equal(trayLocationName("win32"), "notification area");
  assert.equal(trayLocationName("darwin"), "menu bar");
  assert.equal(trayLocationName("linux"), "system tray");
  assert.equal(trayLocationName("sunos"), "system tray");
});

test("the tooltip counts tasks and singularises correctly", () => {
  assert.equal(trayTooltip({ connected: true, taskCount: 0 }), "Plane Pin — 0 assigned tasks");
  assert.equal(trayTooltip({ connected: true, taskCount: 1 }), "Plane Pin — 1 assigned task");
  assert.equal(trayTooltip({ connected: true, taskCount: 12 }), "Plane Pin — 12 assigned tasks");
});

test("the tooltip says so when there is no token", () => {
  assert.equal(trayTooltip({ connected: false, taskCount: 4 }), "Plane Pin — not connected");
  assert.equal(trayTooltip({}), "Plane Pin — not connected");
});

test("a missing or nonsense count never reaches the tooltip", () => {
  assert.equal(trayTooltip({ connected: true }), "Plane Pin — 0 assigned tasks");
  assert.equal(trayTooltip({ connected: true, taskCount: -3 }), "Plane Pin — 0 assigned tasks");
  assert.equal(trayTooltip({ connected: true, taskCount: Number.NaN }), "Plane Pin — 0 assigned tasks");
});
