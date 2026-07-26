"use strict";

const { app, safeStorage } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const encryptedPath = process.env.PLANE_PIN_SAFE_STORAGE_FILE;
const phase = process.env.PLANE_PIN_SAFE_STORAGE_PHASE;
const testToken = "plane-pin-keyring-restart-check";
if (process.env.PLANE_PIN_SAFE_STORAGE_USER_DATA) {
  app.setPath("userData", process.env.PLANE_PIN_SAFE_STORAGE_USER_DATA);
}

app.whenReady().then(async () => {
  assert(encryptedPath, "PLANE_PIN_SAFE_STORAGE_FILE is required");
  console.log(`safeStorage ${phase}: ${app.getName()} at ${app.getPath("userData")}`);
  if (phase === "legacy-save") {
    const encrypted = safeStorage.encryptString(testToken);
    assert(!encrypted.includes(Buffer.from(testToken)), "the legacy token was stored as plaintext");
    fs.writeFileSync(encryptedPath, encrypted);
  } else if (phase === "migrate") {
    const legacy = await safeStorage.decryptStringAsync(fs.readFileSync(encryptedPath));
    assert.equal(legacy.result, testToken, "the Linux async provider could not read the legacy token");
    if (legacy.shouldReEncrypt) {
      fs.writeFileSync(encryptedPath, await safeStorage.encryptStringAsync(legacy.result));
    }
  } else if (phase === "save") {
    const encrypted = process.platform === "linux"
      ? await safeStorage.encryptStringAsync(testToken)
      : safeStorage.encryptString(testToken);
    assert(!encrypted.includes(Buffer.from(testToken)), "the token was stored as plaintext");
    fs.writeFileSync(encryptedPath, encrypted);
  } else if (phase === "load") {
    const encrypted = fs.readFileSync(encryptedPath);
    const decrypted = process.platform === "linux"
      ? (await safeStorage.decryptStringAsync(encrypted)).result
      : safeStorage.decryptString(encrypted);
    assert.equal(decrypted, testToken, "the token did not survive a full Electron restart");
  } else {
    assert.fail("PLANE_PIN_SAFE_STORAGE_PHASE is invalid");
  }
}).then(() => app.quit()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
});
