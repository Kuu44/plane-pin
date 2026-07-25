"use strict";

const trayLocationNames = {
  darwin: "menu bar",
  win32: "notification area",
  linux: "system tray"
};

function trayLocationName(platform = process.platform) {
  return trayLocationNames[platform] || trayLocationNames.linux;
}

function trayTooltip(state = {}) {
  if (!state.connected) return "Plane Pin — not connected";
  const count = Number.isFinite(state.taskCount) ? Math.max(0, Math.trunc(state.taskCount)) : 0;
  return `Plane Pin — ${count} assigned ${count === 1 ? "task" : "tasks"}`;
}

function buildTrayMenuTemplate(state = {}) {
  const platform = state.platform || process.platform;
  const connected = state.connected !== false;
  return [
    { id: "show", type: "normal", label: state.windowVisible ? "Hide Plane Pin" : "Show Plane Pin" },
    { type: "separator" },
    { id: "refresh", type: "normal", label: "Refresh tasks", enabled: connected },
    { id: "always-on-top", type: "checkbox", label: "Always on top", checked: Boolean(state.alwaysOnTop) },
    { id: "compact-cards", type: "checkbox", label: "Compact cards", checked: Boolean(state.compactCards) },
    { id: "settings", type: "normal", label: "Settings…" },
    { type: "separator" },
    { id: "quit", type: "normal", label: platform === "darwin" ? "Quit Plane Pin" : "Exit Plane Pin" }
  ];
}

module.exports = { buildTrayMenuTemplate, trayLocationName, trayTooltip };
