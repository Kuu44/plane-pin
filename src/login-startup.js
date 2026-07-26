"use strict";

const fs = require("node:fs");
const path = require("node:path");

const hiddenLaunchArgument = "--hidden";
const linuxAutostartFileName = "plane-pin.desktop";

function quoteDesktopExec(value) {
  const text = String(value);
  if (!text || /[\r\n]/.test(text)) throw new Error("The application path is invalid.");
  return `"${text.replace(/(["\\`$])/g, "\\$1")}"`;
}

function linuxAutostartPath(appDataPath) {
  return path.join(appDataPath, "autostart", linuxAutostartFileName);
}

function linuxAutostartContents(executablePath) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=Plane Pin",
    "Comment=Keep Plane tasks close after sign-in",
    `Exec=${quoteDesktopExec(executablePath)} ${hiddenLaunchArgument}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    ""
  ].join("\n");
}

function linuxExecutable(env, executablePath) {
  return String(env.APPIMAGE || executablePath);
}

function linuxLoginStartupEnabled(appDataPath, fileSystem = fs) {
  return fileSystem.existsSync(linuxAutostartPath(appDataPath));
}

function setLinuxLoginStartup(enabled, appDataPath, executablePath, fileSystem = fs) {
  const target = linuxAutostartPath(appDataPath);
  if (!enabled) {
    try {
      fileSystem.unlinkSync(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return false;
  }

  const directory = path.dirname(target);
  const temporary = `${target}.next`;
  fileSystem.mkdirSync(directory, { recursive: true });
  fileSystem.writeFileSync(temporary, linuxAutostartContents(executablePath), { mode: 0o600 });
  fileSystem.renameSync(temporary, target);
  return true;
}

module.exports = {
  hiddenLaunchArgument,
  linuxAutostartContents,
  linuxAutostartPath,
  linuxExecutable,
  linuxLoginStartupEnabled,
  quoteDesktopExec,
  setLinuxLoginStartup
};
