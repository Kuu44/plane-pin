"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const trayCommands = new Set(["refresh", "settings", "always-on-top", "compact-cards"]);

contextBridge.exposeInMainWorld("planePin", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  discoverWorkspace: (settings) => ipcRenderer.invoke("setup:discover", settings),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-always-on-top", enabled),
  setPreference: (key, value) => ipcRenderer.invoke("settings:set-preference", key, value),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  setWindowCompactMode: (enabled) => ipcRenderer.invoke("window:set-compact-mode", enabled),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  startWindowDrag: () => ipcRenderer.invoke("window:drag-start"),
  moveWindowBy: (deltaX, deltaY) => ipcRenderer.invoke("window:drag-move", deltaX, deltaY),
  endWindowDrag: () => ipcRenderer.invoke("window:drag-end"),
  openTask: (url) => ipcRenderer.invoke("task:open", url),
  listTasks: () => ipcRenderer.invoke("tasks:list"),
  onTrayCommand: (handler) => {
    ipcRenderer.on("tray:command", (_event, command) => {
      if (trayCommands.has(command)) handler(command);
    });
  }
});
