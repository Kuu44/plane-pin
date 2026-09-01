"use strict";

const fs = require("node:fs");
const path = require("node:path");

const hiddenLaunchArgument = "--hidden";
const linuxAutostartFileName = "plane-pin.desktop";
const macLoginStatuses = new Set(["enabled", "requires-approval", "not-registered", "not-found"]);
const desktopBooleanKeys = new Set([
  "DBusActivatable",
  "Hidden",
  "NoDisplay",
  "StartupNotify",
  "Terminal",
  "X-GNOME-Autostart-enabled",
  "X-GNOME-UsesNotifications"
]);

function quoteDesktopExec(value) {
  if (typeof value !== "string") throw new Error("The application path is invalid.");
  const text = value;
  if (!text.trim() || /[\u0000-\u001f\u007f%\r\n]/.test(text)) {
    throw new Error("The application path is invalid.");
  }
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
  return typeof env?.APPIMAGE === "string" && env.APPIMAGE
    ? env.APPIMAGE
    : String(executablePath || "");
}

function parseDesktopExec(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("The autostart Exec entry is missing.");
  const tokens = [];
  let token = "";
  let quoted = false;
  let escaped = false;
  let hasToken = false;
  for (const character of value) {
    if (escaped) {
      if (!["\\", '"', "`", "$"].includes(character)) {
        throw new Error("The autostart Exec entry has an invalid escape.");
      }
      token += character;
      escaped = false;
      hasToken = true;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      hasToken = true;
      continue;
    }
    if (/\s/.test(character) && !quoted) {
      if (hasToken) {
        tokens.push(token);
        token = "";
        hasToken = false;
      }
      continue;
    }
    if (character === "%") throw new Error("The autostart Exec entry contains an unsupported field code.");
    token += character;
    hasToken = true;
  }
  if (escaped || quoted) throw new Error("The autostart Exec entry is not valid.");
  if (hasToken) tokens.push(token);
  return tokens;
}

function parseDesktopEntry(contents) {
  if (typeof contents !== "string") throw new Error("The autostart file is not valid text.");
  const entries = new Map();
  let inDesktopEntry = false;
  let foundDesktopEntry = false;
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\[[^\]]+\]$/.test(line)) {
      if (line !== "[Desktop Entry]") {
        inDesktopEntry = false;
        continue;
      }
      if (foundDesktopEntry) throw new Error("The autostart file has duplicate Desktop Entry sections.");
      foundDesktopEntry = true;
      inDesktopEntry = true;
      continue;
    }
    if (!inDesktopEntry) throw new Error("The autostart file is malformed.");
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("The autostart file is malformed.");
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z0-9-]+$/.test(key)) throw new Error("The autostart file has an invalid key.");
    if (entries.has(key)) throw new Error(`The autostart file repeats ${key}.`);
    entries.set(key, line.slice(separator + 1).trim());
  }
  if (!foundDesktopEntry) throw new Error("The autostart file is missing its Desktop Entry section.");
  if (entries.get("Type") !== "Application") {
    throw new Error("The autostart entry must declare Type=Application.");
  }
  if (!entries.get("Name")) throw new Error("The autostart entry must include a Name.");
  for (const key of desktopBooleanKeys) {
    if (!entries.has(key)) continue;
    const value = entries.get(key).toLocaleLowerCase();
    if (value !== "true" && value !== "false") {
      throw new Error(`The autostart entry has an invalid Boolean value for ${key}.`);
    }
  }
  return entries;
}

function linuxLoginStartupState(appDataPath, executablePath, fileSystem = fs) {
  if (executablePath && typeof executablePath === "object") {
    fileSystem = executablePath;
    executablePath = "";
  }
  const target = linuxAutostartPath(appDataPath);
  if (typeof fileSystem.readFileSync !== "function") {
    return { registered: null, effective: null, status: "unknown" };
  }
  let contents;
  try {
    contents = fileSystem.readFileSync(target, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { registered: false, effective: false, status: "disabled" };
    return { registered: null, effective: null, status: "error", error: error?.message || String(error) };
  }

  let entries;
  let exec;
  try {
    entries = parseDesktopEntry(contents);
    exec = parseDesktopExec(entries.get("Exec"));
  } catch (error) {
    return { registered: true, effective: false, status: "invalid", error: error.message };
  }
  const expectedExecutable = String(executablePath || "");
  const targetMatches = exec.length === 2
    && (!expectedExecutable || exec[0] === expectedExecutable)
    && exec[1] === hiddenLaunchArgument;
  if (!targetMatches) {
    return {
      registered: false,
      effective: false,
      status: "invalid",
      error: "The autostart entry points to a different or stale Plane Pin executable."
    };
  }
  const hidden = String(entries.get("Hidden") || "").toLocaleLowerCase() === "true";
  const gnomeDisabled = String(entries.get("X-GNOME-Autostart-enabled") || "").toLocaleLowerCase() === "false";
  if (hidden || gnomeDisabled) {
    return { registered: true, effective: false, status: "disabled" };
  }
  if (typeof fileSystem.existsSync === "function" && !fileSystem.existsSync(exec[0])) {
    return {
      registered: true,
      effective: false,
      status: "invalid",
      error: "The autostart entry points to an executable that is no longer available."
    };
  }
  return { registered: true, effective: true, status: "enabled" };
}

function linuxLoginStartupEnabled(appDataPath, executablePath, fileSystem = fs) {
  return linuxLoginStartupState(appDataPath, executablePath, fileSystem).effective === true;
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

function windowsPath(value) {
  return String(value || "").replaceAll("/", "\\").toLocaleLowerCase();
}

function windowsArgs(value) {
  if (Array.isArray(value)) return value.map((argument) => String(argument));
  if (typeof value !== "string") return [];
  const args = [];
  let token = "";
  let quoted = false;
  let escaped = false;
  for (const character of value.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (/\s/.test(character) && !quoted) {
      if (token) {
        args.push(token);
        token = "";
      }
    } else {
      token += character;
    }
  }
  if (escaped || quoted) return [];
  if (token) args.push(token);
  return args;
}

function windowsLaunchItemMatches(item, executablePath, expectedArgs = [hiddenLaunchArgument]) {
  if (!item || windowsPath(item.path) !== windowsPath(executablePath)) return false;
  const actualArgs = windowsArgs(item.args);
  return actualArgs.length === expectedArgs.length
    && actualArgs.every((argument, index) => argument === expectedArgs[index]);
}

function windowsLoginStartupState(state = {}, executablePath, requested = false) {
  if (!state || typeof state !== "object") state = {};
  const launchItems = Array.isArray(state.launchItems) ? state.launchItems : null;
  const matchingItem = launchItems?.find((item) => windowsLaunchItemMatches(item, executablePath));
  const exactRegistered = launchItems ? Boolean(matchingItem) : state.openAtLogin === true;
  if (!exactRegistered) {
    return {
      requested: Boolean(requested),
      registered: false,
      effective: false,
      status: "disabled"
    };
  }

  const approval = matchingItem && typeof matchingItem.enabled === "boolean"
    ? matchingItem.enabled
    : typeof state.executableWillLaunchAtLogin === "boolean"
      ? state.executableWillLaunchAtLogin
      : typeof state.approved === "boolean"
        ? state.approved
        : null;
  if (state.openAtLogin === false || approval === false || state.approvalStatus === "blocked") {
    return { requested: Boolean(requested), registered: true, effective: false, status: "blocked" };
  }
  if (approval === true) return { requested: Boolean(requested), registered: true, effective: true, status: "enabled" };
  return { requested: Boolean(requested), registered: true, effective: null, status: "configured" };
}

function macLoginStartupState(state = {}, requested = false) {
  if (!state || typeof state !== "object") state = {};
  const rawStatus = String(state.status || (state.openAtLogin ? "enabled" : "not-registered"))
    .toLocaleLowerCase();
  const status = macLoginStatuses.has(rawStatus) ? rawStatus : "unknown";
  if (status === "enabled") return { requested: Boolean(requested), registered: true, effective: true, status };
  if (status === "requires-approval") {
    return { requested: true, registered: true, effective: null, status };
  }
  if (status === "not-registered") {
    return { requested: Boolean(requested), registered: false, effective: false, status };
  }
  if (status === "not-found") {
    return { requested: Boolean(requested), registered: false, effective: null, status };
  }
  return { requested: Boolean(requested), registered: null, effective: null, status };
}

module.exports = {
  hiddenLaunchArgument,
  linuxAutostartContents,
  linuxAutostartPath,
  linuxExecutable,
  linuxLoginStartupState,
  linuxLoginStartupEnabled,
  macLoginStartupState,
  parseDesktopEntry,
  parseDesktopExec,
  quoteDesktopExec,
  setLinuxLoginStartup,
  windowsLaunchItemMatches,
  windowsLoginStartupState
};
