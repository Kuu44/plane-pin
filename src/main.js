"use strict";

const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { fetchInProgressTasks, normalizeBaseUrl } = require("./plane-client");

let mainWindow;
let sessionToken = "";

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readStoredSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeStoredSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function loadSettings() {
  try {
    const stored = readStoredSettings();
    if (stored.apiToken && safeStorage.isEncryptionAvailable()) {
      sessionToken = safeStorage.decryptString(Buffer.from(stored.apiToken, "base64"));
    }
    return {
      baseUrl: stored.baseUrl || "",
      workspaceSlug: stored.workspaceSlug || "",
      projectId: stored.projectId || "",
      alwaysOnTop: stored.alwaysOnTop !== false
    };
  } catch {
    return { baseUrl: "", workspaceSlug: "", projectId: "", alwaysOnTop: true };
  }
}

function saveSettings(input) {
  const current = loadSettings();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const workspaceSlug = String(input.workspaceSlug || "").trim();
  const projectId = String(input.projectId || "").trim();
  const alwaysOnTop = Boolean(input.alwaysOnTop);
  const nextToken = String(input.apiToken || "").trim() || sessionToken;

  if (!workspaceSlug || !projectId || !nextToken) {
    throw new Error("Plane URL, workspace slug, project ID or key, and API token are required.");
  }

  sessionToken = nextToken;
  const stored = { baseUrl, workspaceSlug, projectId, alwaysOnTop };
  if (safeStorage.isEncryptionAvailable()) {
    stored.apiToken = safeStorage.encryptString(nextToken).toString("base64");
  }
  writeStoredSettings(stored);
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  return { persistedToken: Boolean(stored.apiToken) };
}

function publicSettings() {
  const settings = loadSettings();
  return { ...settings, tokenSet: Boolean(sessionToken) };
}

function createWindow() {
  const settings = loadSettings();
  mainWindow = new BrowserWindow({
    width: 380,
    height: 650,
    minWidth: 320,
    minHeight: 420,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#f6f7fb",
    title: "Plane Pin",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("settings:get", () => publicSettings());
ipcMain.handle("settings:save", (_event, input) => saveSettings(input));
ipcMain.handle("window:set-always-on-top", (_event, enabled) => {
  const alwaysOnTop = Boolean(enabled);
  writeStoredSettings({ ...readStoredSettings(), alwaysOnTop });
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  return alwaysOnTop;
});
ipcMain.handle("tasks:list", async () => {
  const settings = loadSettings();
  if (!settings.baseUrl || !settings.workspaceSlug || !settings.projectId || !sessionToken) {
    throw new Error("Connect Plane first.");
  }
  const tasks = await fetchInProgressTasks({ ...settings, apiToken: sessionToken });
  return tasks.map((task) => ({
    id: String(task.id),
    name: String(task.name || "Untitled work item"),
    identifier: task.project?.identifier && task.sequence_id
      ? `${task.project.identifier}-${task.sequence_id}`
      : task.sequence_id
        ? `#${task.sequence_id}`
        : "Work item",
    priority: String(task.priority || "none"),
    targetDate: task.target_date || null,
    stateName: String(task.state?.name || "In Progress")
  }));
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
