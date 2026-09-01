"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  linuxLoginStartupEnabled,
  linuxLoginStartupState,
  linuxAutostartContents,
  linuxAutostartPath,
  linuxExecutable,
  macLoginStartupState,
  setLinuxLoginStartup,
  windowsLoginStartupState
} = require("../src/login-startup");

test("creates a quiet XDG autostart entry for the installed Linux executable", () => {
  const writes = [];
  const fs = {
    mkdirSync: () => {},
    writeFileSync: (file, value, options) => writes.push({ file, value, options }),
    renameSync: (from, to) => writes.push({ from, to })
  };
  const target = path.join("/home/kuu/.config", "autostart", "plane-pin.desktop");

  assert.equal(setLinuxLoginStartup(true, "/home/kuu/.config", "/opt/Plane Pin.AppImage", fs), true);
  assert.equal(writes[0].file, `${target}.next`);
  assert.match(writes[0].value, /Exec="\/opt\/Plane Pin\.AppImage" --hidden/);
  assert.equal(writes[0].options.mode, 0o600);
  assert.deepEqual(writes[1], {
    from: `${target}.next`,
    to: target
  });
});

test("prefers the AppImage path and emits a valid desktop entry", () => {
  assert.equal(linuxExecutable({ APPIMAGE: "/apps/Plane.Pin.AppImage" }, "/tmp/mounted-app"), "/apps/Plane.Pin.AppImage");
  assert.equal(linuxAutostartPath("/home/kuu/.config"), path.join("/home/kuu/.config", "autostart", "plane-pin.desktop"));
  assert.match(linuxAutostartContents('/apps/Plane "Pin".AppImage'), /Exec="\/apps\/Plane \\"Pin\\"\.AppImage" --hidden/);
});

test("disabling login startup removes only Plane Pin's autostart file", () => {
  let removed = "";
  const fs = { unlinkSync: (file) => { removed = file; } };
  assert.equal(setLinuxLoginStartup(false, "/home/kuu/.config", "ignored", fs), false);
  assert.equal(removed, path.join("/home/kuu/.config", "autostart", "plane-pin.desktop"));
});

function linuxReadback(contents, executablePath, executableExists = true) {
  return linuxLoginStartupState("/home/kuu/.config", executablePath, {
    readFileSync: () => contents,
    existsSync: (candidate) => candidate === executablePath && executableExists
  });
}

test("reads a valid Linux entry and confirms the current executable", () => {
  const executable = "/opt/Plane Pin.AppImage";
  const state = linuxReadback(linuxAutostartContents(executable), executable);

  assert.deepEqual(state, { registered: true, effective: true, status: "enabled" });
  assert.equal(linuxLoginStartupEnabled("/home/kuu/.config", executable, {
    readFileSync: () => linuxAutostartContents(executable),
    existsSync: () => true
  }), true);
});

test("treats disabled Linux desktop-entry flags as registered but inactive", () => {
  const executable = "/opt/Plane Pin.AppImage";
  const hidden = linuxAutostartContents(executable).replace("X-GNOME-Autostart-enabled=true", "Hidden=true");
  const gnomeDisabled = linuxAutostartContents(executable).replace("X-GNOME-Autostart-enabled=true", "X-GNOME-Autostart-enabled=false");

  assert.deepEqual(linuxReadback(hidden, executable), { registered: true, effective: false, status: "disabled" });
  assert.deepEqual(linuxReadback(gnomeDisabled, executable), { registered: true, effective: false, status: "disabled" });
});

test("rejects malformed, stale, and missing Linux autostart targets", () => {
  const executable = "/opt/Plane Pin.AppImage";
  assert.equal(linuxReadback("[Desktop Entry]\nType=Application\n", executable).status, "invalid");
  assert.equal(linuxReadback(linuxAutostartContents("/old/Plane Pin.AppImage"), executable).status, "invalid");
  assert.equal(linuxReadback(linuxAutostartContents(executable), executable, false).status, "invalid");
  assert.deepEqual(linuxLoginStartupState("/home/kuu/.config", executable, {
    readFileSync: () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; }
  }), { registered: false, effective: false, status: "disabled" });
});

test("rejects Linux entries without required keys, duplicate keys, or valid Boolean values", () => {
  const executable = "/opt/Plane Pin.AppImage";
  const valid = linuxAutostartContents(executable);

  assert.equal(linuxReadback(valid.replace("Type=Application\n", ""), executable).status, "invalid");
  assert.equal(linuxReadback(valid.replace("Name=Plane Pin\n", ""), executable).status, "invalid");
  assert.equal(linuxReadback(valid.replace("Name=Plane Pin\n", "Name=Plane Pin\nName=Another Name\n"), executable).status, "invalid");
  assert.equal(linuxReadback(valid.replace("X-GNOME-Autostart-enabled=true", "X-GNOME-Autostart-enabled=maybe"), executable).status, "invalid");
});

test("reports unknown Linux registration when the autostart file cannot be read", () => {
  const error = new Error("permission denied");
  error.code = "EACCES";

  assert.deepEqual(linuxLoginStartupState("/home/kuu/.config", "/opt/Plane Pin.AppImage", {
    readFileSync: () => { throw error; }
  }), { registered: null, effective: null, status: "error", error: "permission denied" });
});

test("quotes supported Linux paths and rejects unsafe Exec values", () => {
  assert.match(linuxAutostartContents('/apps/Plane "Pin"\\build.AppImage'), /Exec="\/apps\/Plane \\"Pin\\"\\\\build\.AppImage" --hidden/);
  assert.throws(() => linuxAutostartContents("/apps/Plane%20Pin.AppImage"), /application path is invalid/i);
  assert.throws(() => linuxAutostartContents("/apps/Plane\nPin.AppImage"), /application path is invalid/i);
});

test("requires explicit enablement before a missing Linux entry is created", () => {
  let writes = 0;
  const fileSystem = {
    readFileSync: () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
    writeFileSync: () => { writes += 1; },
    existsSync: () => false
  };
  assert.deepEqual(linuxLoginStartupState("/home/kuu/.config", "/opt/Plane Pin.AppImage", fileSystem), {
    registered: false,
    effective: false,
    status: "disabled"
  });
  assert.equal(writes, 0);
});

test("matches only the exact Windows executable and hidden launch arguments", () => {
  const executable = "C:\\Program Files\\Plane Pin\\Plane Pin.exe";
  const state = windowsLoginStartupState({
    openAtLogin: true,
    executableWillLaunchAtLogin: true,
    launchItems: [
      { path: executable, args: ["--hidden"], enabled: true },
      { path: executable, args: [], enabled: true }
    ]
  }, executable, true);

  assert.deepEqual(state, { requested: true, registered: true, effective: true, status: "enabled" });
  assert.deepEqual(windowsLoginStartupState({
    openAtLogin: true,
    executableWillLaunchAtLogin: true,
    launchItems: [{ path: executable, args: [], enabled: true }]
  }, executable, true), { requested: true, registered: false, effective: false, status: "disabled" });
});

test("reports a registered but unapproved Windows entry as blocked", () => {
  const executable = "C:\\Program Files\\Plane Pin\\Plane Pin.exe";
  assert.deepEqual(windowsLoginStartupState({
    openAtLogin: true,
    executableWillLaunchAtLogin: false,
    launchItems: [{ path: executable, args: "--hidden", enabled: false }]
  }, executable, true), { requested: true, registered: true, effective: false, status: "blocked" });
  assert.deepEqual(windowsLoginStartupState({
    openAtLogin: true,
    executableWillLaunchAtLogin: false
  }, executable, true), { requested: true, registered: true, effective: false, status: "blocked" });
});

test("keeps Windows registration separate when approval evidence is unavailable", () => {
  const executable = "C:\\Program Files\\Plane Pin\\Plane Pin.exe";
  assert.deepEqual(windowsLoginStartupState({ openAtLogin: true }, executable, true), {
    requested: true,
    registered: true,
    effective: null,
    status: "configured"
  });
});

test("preserves macOS intent while reporting native login-item statuses", () => {
  assert.deepEqual(macLoginStartupState({ status: "requires-approval", openAtLogin: false }, false), {
    requested: true,
    registered: true,
    effective: null,
    status: "requires-approval"
  });
  assert.deepEqual(macLoginStartupState({ status: "enabled", openAtLogin: true }, true), {
    requested: true,
    registered: true,
    effective: true,
    status: "enabled"
  });
  assert.deepEqual(macLoginStartupState({ status: "not-registered" }, true), {
    requested: true,
    registered: false,
    effective: false,
    status: "not-registered"
  });
  assert.deepEqual(macLoginStartupState({ status: "not-found" }, true), {
    requested: true,
    registered: false,
    effective: null,
    status: "not-found"
  });
});
