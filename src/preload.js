"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("planePin", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  discoverWorkspace: (settings) => ipcRenderer.invoke("setup:discover", settings),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-always-on-top", enabled),
  setPreference: (key, value) => ipcRenderer.invoke("settings:set-preference", key, value),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  openTask: (url) => ipcRenderer.invoke("task:open", url),
  listTasks: () => ipcRenderer.invoke("tasks:list")
});
