"use strict";

const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { discoverWorkspace, fetchAssignedTasks, isUuid, normalizeBaseUrl } = require("./plane-client");
const { cleanStateNames, loadStoredSettings } = require("./settings-model");

let mainWindow;
let sessionToken = "";

const developmentUserDataArgument = process.argv.find((argument) => argument.startsWith("--plane-pin-user-data-dir="));
const developmentUserData = !app.isPackaged
  && (process.env.PLANE_PIN_USER_DATA_DIR || developmentUserDataArgument?.split("=").slice(1).join("="));
if (developmentUserData) app.disableHardwareAcceleration();
app.setPath("userData", developmentUserData || path.join(app.getPath("appData"), "plane-pin"));

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readStoredSettings() {
  const candidates = [settingsPath(), path.join(app.getPath("userData"), "settings.backup.json")];
  for (const candidate of candidates) {
    try {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
      // Try the valid backup before treating this as a first run.
    }
  }
  return {};
}

function writeStoredSettings(settings) {
  const target = settingsPath();
  const directory = path.dirname(target);
  const backup = path.join(directory, "settings.backup.json");
  const temporary = path.join(directory, "settings.next.json");
  fs.mkdirSync(directory, { recursive: true });
  try {
    JSON.parse(fs.readFileSync(target, "utf8"));
    fs.copyFileSync(target, backup);
  } catch {
    // A missing or invalid primary file must not replace a valid backup.
  }
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function loadSettings() {
  const loaded = loadStoredSettings(readStoredSettings(), (encryptedToken) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("OS encryption is unavailable.");
    return safeStorage.decryptString(Buffer.from(encryptedToken, "base64"));
  });
  if (loaded.token) sessionToken = loaded.token;
  return { ...loaded.settings, tokenError: loaded.tokenError };
}

function saveSettings(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const workspaceSlug = String(input.workspaceSlug || "").trim();
  const projectId = String(input.projectId || "").trim();
  const projectScope = input.projectScope === "single" ? "single" : "all";
  const memberId = String(input.memberId || "").trim();
  const memberName = String(input.memberName || "").trim();
  const stateFilterMode = input.stateFilterMode === "selected" ? "selected" : "all";
  const stateNames = cleanStateNames(input.stateNames);
  const groupByProject = Boolean(input.groupByProject);
  const alwaysOnTop = Boolean(input.alwaysOnTop);
  const nextToken = String(input.apiToken || "").trim() || sessionToken;

  if (!workspaceSlug || !memberId || !nextToken || (projectScope === "single" && !projectId)) {
    throw new Error("Plane URL, workspace, account, and API token are required.");
  }
  if (!isUuid(memberId)) {
    throw new Error("Member ID must be the UUID from your Plane profile URL.");
  }
  if (stateFilterMode === "selected" && stateNames.length === 0) {
    throw new Error("Select at least one state or choose All states.");
  }

  sessionToken = nextToken;
  const stored = {
    baseUrl,
    workspaceSlug,
    projectId,
    projectScope,
    memberId,
    memberName,
    stateFilterMode,
    stateNames,
    groupByProject,
    alwaysOnTop,
    setupComplete: true
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

function startAutoUpdates() {
  if (!app.isPackaged || !process.env.GH_TOKEN) return;
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error(`Update check failed: ${error.message}`);
  });
}

ipcMain.handle("settings:get", () => publicSettings());
ipcMain.handle("settings:save", (_event, input) => saveSettings(input));
ipcMain.handle("setup:discover", async (_event, input) => {
  const apiToken = String(input.apiToken || "").trim() || sessionToken;
  if (!apiToken) throw new Error("Enter your personal access token first.");
  return discoverWorkspace({
    baseUrl: input.baseUrl,
    workspaceSlug: String(input.workspaceSlug || "").trim(),
    apiToken
  });
});
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
  app.setAppUserModelId("com.niyalo.planepin");
  createWindow();
  startAutoUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
