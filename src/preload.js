"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("planePin", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  discoverWorkspace: (settings) => ipcRenderer.invoke("setup:discover", settings),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-always-on-top", enabled),
  listTasks: () => ipcRenderer.invoke("tasks:list")
});
