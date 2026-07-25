"use strict";

function windowChromeOptions(platform = process.platform) {
  return platform === "darwin"
    ? { frame: true, titleBarStyle: "hiddenInset" }
    : { frame: false };
}

function shouldHideToTray({ preference, quitting = false, trayAvailable = false }) {
  return Boolean(preference && trayAvailable && !quitting);
}

module.exports = { shouldHideToTray, windowChromeOptions };
