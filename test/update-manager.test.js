"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUpdateManager } = require("../src/update-manager");

function fakeUpdater() {
  const updater = new EventEmitter();
  updater.checks = 0;
  updater.downloads = 0;
  updater.installs = [];
  updater.checkForUpdates = async () => { updater.checks += 1; };
  updater.downloadUpdate = async () => { updater.downloads += 1; };
  updater.quitAndInstall = (...args) => updater.installs.push(args);
  return updater;
}

test("a private feed never checks without a credential", async () => {
  const updater = fakeUpdater();
  const manager = createUpdateManager({
    updater,
    currentVersion: "0.11.0",
    supported: true,
    hasCredential: () => false,
    configureCredential: () => assert.fail("must not configure without a credential")
  });

  assert.equal((await manager.check()).status, "auth-required");
  assert.equal(updater.checks, 0);
});

test("the update button downloads, installs, and restarts in one flow", async () => {
  const updater = fakeUpdater();
  let configured = 0;
  let prepared = 0;
  const manager = createUpdateManager({
    updater,
    currentVersion: "0.11.0",
    supported: true,
    hasCredential: () => true,
    configureCredential: () => { configured += 1; },
    beforeInstall: () => { prepared += 1; },
    defer: (callback) => callback()
  });

  const check = manager.check();
  updater.emit("update-available", { version: "0.12.0" });
  await check;
  const install = manager.install();
  updater.emit("download-progress", { percent: 62.4 });
  updater.emit("update-downloaded", { version: "0.12.0" });
  await install;

  assert.equal(configured, 1);
  assert.equal(updater.checks, 1);
  assert.equal(updater.downloads, 1);
  assert.equal(prepared, 1);
  assert.deepEqual(updater.installs, [[true, true]]);
  assert.equal(manager.getState().status, "installing");
});

test("unsupported builds explain the platform block without contacting a feed", async () => {
  const updater = fakeUpdater();
  const manager = createUpdateManager({
    updater,
    currentVersion: "0.11.0",
    supported: false,
    unsupportedMessage: "Automatic macOS updates need a signed and notarised build.",
    hasCredential: () => true,
    configureCredential: () => {}
  });

  const state = await manager.check();
  assert.equal(state.status, "unavailable");
  assert.match(state.message, /signed and notarised/);
  assert.equal(updater.checks, 0);
});
