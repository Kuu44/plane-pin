"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const html = readFileSync(join(__dirname, "../src/renderer/index.html"), "utf8");
const renderer = readFileSync(join(__dirname, "../src/renderer/renderer.js"), "utf8");
const main = readFileSync(join(__dirname, "../src/main.js"), "utf8");

test("onboarding contains the recommended ninth launch-at-sign-in page", () => {
  assert.equal((html.match(/class="setup-step" data-step="\d+"/g) || []).length, 9);
  assert.match(html, /class="setup-step" data-step="8"/);
  assert.match(html, /<h3>Start good habits!<\/h3>/);
  assert.match(html, /id="setup-start-at-login" type="checkbox" checked/);
  assert.match(html, /Windows notification area, macOS menu bar, or Linux system tray/);
  assert.match(html, /no tray is available/);
  assert.match(html, /changed later in Settings/);
});

test("onboarding flow reaches step eight before saving and loading the first task list", () => {
  assert.match(renderer, /"Start good habits!"/);
  assert.match(renderer, /Step \$\{setupStep\} of 8/);
  assert.match(renderer, /if \(setupStep === 7\) return showStep\(8\)/);
  assert.match(renderer, /startAtLogin: elements\.setupStartAtLogin\.checked/);
  assert.match(renderer, /elements\.setup\.close\(\);\s*scheduleAutoRefresh\(\);\s*await refreshTasks\(\);/);
});

test("login startup status copy covers platform approval, blocking, errors, and development", () => {
  assert.match(renderer, /Configured: Plane Pin starts when you sign in/);
  assert.match(renderer, /System Settings → General → Login Items/);
  assert.match(renderer, /Windows Settings → Apps → Startup/);
  assert.match(renderer, /invalid or stale/);
  assert.match(renderer, /Save again to retry/);
  assert.match(renderer, /Development builds do not register at sign-in/);
  assert.match(renderer, /applyLoginStartupStatus\(settings\)/);
});

test("main process exposes requested, registered, effective, and status separately", () => {
  assert.match(main, /const loginStartup = loginStartupState\(\);/);
  assert.match(main, /loginStartup,\s*loginStartupRequested: loginStartup\.requested/);
  assert.match(main, /loginStartupRegistered: loginStartup\.registered/);
  assert.match(main, /loginStartupEffective: loginStartup\.effective/);
  assert.match(main, /loginStartupStatus: loginStartup\.status/);
  assert.match(main, /stored\.startAtLogin = startAtLogin;/);
  assert.doesNotMatch(main, /stored\.startAtLogin = setLoginStartup/);
});

test("settings reloads platform startup status after every successful save", () => {
  assert.match(renderer, /settings = await window\.planePin\.getSettings\(\);[\s\S]{0,120}if \(elements\.settingsToken\.value\)/);
  assert.match(renderer, /settings = await window\.planePin\.getSettings\(\);\s*applySettingsToShell\(\);/);
  assert.match(renderer, /elements\.settingsStartAtLoginNote\.textContent = loginStartupStatusCopy\(nextSettings\)/);
});
