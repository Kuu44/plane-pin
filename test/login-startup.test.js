"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  linuxAutostartContents,
  linuxAutostartPath,
  linuxExecutable,
  setLinuxLoginStartup
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
