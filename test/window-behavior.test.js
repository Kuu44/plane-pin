"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldHideToTray, windowChromeOptions } = require("../src/window-behavior");

test("macOS keeps native traffic lights while Windows and Linux stay frameless", () => {
  assert.deepEqual(windowChromeOptions("darwin"), { frame: true, titleBarStyle: "hiddenInset" });
  assert.deepEqual(windowChromeOptions("win32"), { frame: false });
  assert.deepEqual(windowChromeOptions("linux"), { frame: false });
});

test("the window hides only when a recoverable tray icon exists", () => {
  assert.equal(shouldHideToTray({ preference: true, trayAvailable: true }), true);
  assert.equal(shouldHideToTray({ preference: false, trayAvailable: true }), false);
  assert.equal(shouldHideToTray({ preference: true, trayAvailable: false }), false);
  assert.equal(shouldHideToTray({ preference: true, trayAvailable: true, quitting: true }), false);
});
