"use strict";

const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { fetchAssignedTasks, isUuid, normalizeBaseUrl } = require("./plane-client");

let mainWindow;
let sessionToken = "";
const statusGroups = new Set(["backlog", "unstarted", "started", "completed", "cancelled"]);

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
      projectScope: stored.projectScope === "single" ? "single" : "all",
      memberId: stored.memberId || "",
      statusGroup: statusGroups.has(stored.statusGroup) ? stored.statusGroup : "started",
      groupByProject: stored.groupByProject !== false,
      alwaysOnTop: stored.alwaysOnTop !== false
    };
  } catch {
    return {
      baseUrl: "",
      workspaceSlug: "",
      projectId: "",
      projectScope: "all",
      memberId: "",
      statusGroup: "started",
      groupByProject: true,
      alwaysOnTop: true
    };
  }
}

function saveSettings(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const workspaceSlug = String(input.workspaceSlug || "").trim();
  const projectId = String(input.projectId || "").trim();
  const projectScope = input.projectScope === "single" ? "single" : "all";
  const memberId = String(input.memberId || "").trim();
  const statusGroup = String(input.statusGroup || "");
  const groupByProject = Boolean(input.groupByProject);
  const alwaysOnTop = Boolean(input.alwaysOnTop);
  const nextToken = String(input.apiToken || "").trim() || sessionToken;

  if (!workspaceSlug || !memberId || !nextToken || (projectScope === "single" && !projectId)) {
    throw new Error("Plane URL, workspace slug, member ID, and API token are required.");
  }
  if (!isUuid(memberId)) {
    throw new Error("Member ID must be the UUID from your Plane profile URL.");
  }
  if (!statusGroups.has(statusGroup)) {
    throw new Error("Choose a valid Plane status group.");
  }

  sessionToken = nextToken;
  const stored = {
    baseUrl,
    workspaceSlug,
    projectId,
    projectScope,
    memberId,
    statusGroup,
    groupByProject,
    alwaysOnTop
  };
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
  if (!settings.baseUrl || !settings.workspaceSlug || !settings.memberId || !sessionToken) {
    throw new Error("Connect Plane first.");
  }
  const tasks = await fetchAssignedTasks({ ...settings, apiToken: sessionToken });
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
    stateName: String(task.state?.name || "Unknown state"),
    projectName: String(task.project?.name || task.project?.identifier || "Project"),
    projectIdentifier: String(task.project?.identifier || "")
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
