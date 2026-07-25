"use strict";

const { app, BrowserWindow, ipcMain, nativeTheme, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { buildTaskUrl, discoverWorkspace, fetchAssignedTasks, isUuid, normalizeBaseUrl } = require("./plane-client");
const { cleanStateNames, loadStoredSettings } = require("./settings-model");

let mainWindow;
let sessionToken = "";
const settingsFileName = "settings.json";

const developmentUserDataArgument = process.argv.find((argument) => argument.startsWith("--plane-pin-user-data-dir="));
const developmentUserData = !app.isPackaged
  && (process.env.PLANE_PIN_USER_DATA_DIR || developmentUserDataArgument?.split("=").slice(1).join("="));
if (developmentUserData) app.disableHardwareAcceleration();
app.setPath("userData", developmentUserData || path.join(app.getPath("appData"), "plane-pin"));

function settingsPath() {
  return path.join(app.getPath("userData"), settingsFileName);
}

function settingsCandidates() {
  const appData = app.getPath("appData");
  const paths = [
    settingsPath(),
    path.join(app.getPath("userData"), "settings.backup.json"),
    path.join(appData, "Plane Pin", settingsFileName),
    path.join(appData, "PlanePin", settingsFileName)
  ];
  const seen = new Set();
  return paths.filter((candidate) => {
    const key = path.resolve(candidate).toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readStoredSettingsCandidates() {
  const records = [];
  for (const candidate of settingsCandidates()) {
    try {
      records.push({ path: candidate, value: JSON.parse(fs.readFileSync(candidate, "utf8")) });
    } catch {
      // Missing and invalid files are skipped; valid backups remain candidates.
    }
  }
  return records;
}

function readStoredSettings() {
  return readStoredSettingsCandidates()[0]?.value || {};
}

function writeStoredSettings(settings, backupCurrent = true) {
  const target = settingsPath();
  const directory = path.dirname(target);
  const backup = path.join(directory, "settings.backup.json");
  const temporary = path.join(directory, "settings.next.json");
  fs.mkdirSync(directory, { recursive: true });
  if (backupCurrent) {
    try {
      JSON.parse(fs.readFileSync(target, "utf8"));
      fs.copyFileSync(target, backup);
    } catch {
      // A missing or invalid primary file must not replace a valid backup.
    }
  }
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function loadSettings() {
  const records = readStoredSettingsCandidates();
  const loaded = loadStoredSettings(records.map((record) => record.value), (encryptedToken) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("OS encryption is unavailable.");
    return safeStorage.decryptString(Buffer.from(encryptedToken, "base64"));
  });
  if (loaded.token) sessionToken = loaded.token;
  const primaryRecord = records[0];
  const tokenRecord = records[loaded.tokenSourceIndex];
  const needsMigration = primaryRecord
    && (primaryRecord.path !== settingsPath()
      || primaryRecord.value.schemaVersion !== 1
      || (loaded.encryptedToken && tokenRecord?.path !== settingsPath()));
  if (needsMigration) {
    writeStoredSettings({
      ...primaryRecord.value,
      ...loaded.settings,
      ...(loaded.encryptedToken ? { apiToken: loaded.encryptedToken } : {})
    }, false);
  }
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
  const refreshMinutes = [0, 1, 5, 10, 15, 30].includes(Number(input.refreshMinutes))
    ? Number(input.refreshMinutes)
    : 5;
  const theme = input.theme === "dark" ? "dark" : "light";
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
    schemaVersion: 1,
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
    refreshMinutes,
    theme,
    setupComplete: true
  };
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Windows encryption is unavailable, so Plane Pin cannot save the API token safely.");
  }
  stored.apiToken = safeStorage.encryptString(nextToken).toString("base64");
  writeStoredSettings(stored);
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  nativeTheme.themeSource = theme;
  return { persistedToken: Boolean(stored.apiToken) };
}

function publicSettings() {
  const settings = loadSettings();
  return { ...settings, tokenSet: Boolean(sessionToken) };
}

function createWindow() {
  const settings = loadSettings();
  nativeTheme.themeSource = settings.theme;
  mainWindow = new BrowserWindow({
    width: 380,
    height: 650,
    minWidth: 320,
    minHeight: 420,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: settings.theme === "dark" ? "#17171a" : "#f7f7f8",
    frame: false,
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
ipcMain.handle("settings:set-preference", (_event, key, value) => {
  const stored = readStoredSettings();
  if (key === "theme") {
    const theme = value === "dark" ? "dark" : "light";
    writeStoredSettings({ ...stored, schemaVersion: 1, theme });
    nativeTheme.themeSource = theme;
    mainWindow?.setBackgroundColor(theme === "dark" ? "#17171a" : "#f7f7f8");
    return theme;
  }
  throw new Error("Unknown preference.");
});
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:toggle-maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("task:open", async (_event, taskUrl) => {
  const settings = loadSettings();
  const url = new URL(taskUrl);
  if (url.origin !== normalizeBaseUrl(settings.baseUrl)) {
    throw new Error("Task link does not belong to the configured Plane server.");
  }
  await shell.openExternal(url.toString());
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
    stateGroup: String(task.state?.group || "unstarted"),
    stateColor: String(task.state?.color || ""),
    projectName: String(task.project?.name || task.project?.identifier || "Project"),
    projectIdentifier: String(task.project?.identifier || ""),
    url: buildTaskUrl(settings.baseUrl, settings.workspaceSlug, task)
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
