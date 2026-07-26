"use strict";

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, nativeTheme, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const {
  hiddenLaunchArgument,
  linuxExecutable,
  linuxLoginStartupEnabled,
  setLinuxLoginStartup
} = require("./login-startup");
const { buildTaskUrl, discoverWorkspace, fetchAssignedTasks, isUuid, normalizeBaseUrl } = require("./plane-client");
const { cleanIds, cleanStateNames, loadStoredSettings, normalizeStoredSettings } = require("./settings-model");
const { buildTrayMenuTemplate, trayLocationName, trayTooltip } = require("./tray-menu");
const { createUpdateManager } = require("./update-manager");
const { shouldHideToTray, windowChromeOptions } = require("./window-behavior");

let mainWindow;
let tray;
let sessionToken = "";
let sessionUpdateToken = "";
let credentialState = {
  tokenError: false,
  tokenUnavailable: false,
  encryptedTokenPresent: false,
  updateTokenError: false,
  updateTokenUnavailable: false,
  encryptedUpdateTokenPresent: false
};
let updateManager;
let quitting = false;
let dragOrigin = null;
let lastTaskCount = 0;
const settingsFileName = "settings.json";
const macAutoUpdatesEnabled = false;

const developmentUserDataArgument = process.argv.find((argument) => argument.startsWith("--plane-pin-user-data-dir="));
const developmentUserData = !app.isPackaged
  && (process.env.PLANE_PIN_USER_DATA_DIR || developmentUserDataArgument?.split("=").slice(1).join("="));
if (developmentUserData) app.disableHardwareAcceleration();
app.setPath("userData", developmentUserData || path.join(app.getPath("appData"), "plane-pin"));

function windowsLoginOptions() {
  return { path: process.execPath, args: [hiddenLaunchArgument] };
}

function loginStartupState() {
  if (!app.isPackaged) {
    return { enabled: normalizeStoredSettings(readStoredSettings()).startAtLogin, status: "development" };
  }
  if (process.platform === "linux") {
    const enabled = linuxLoginStartupEnabled(app.getPath("appData"));
    return {
      enabled,
      status: enabled ? "enabled" : "disabled"
    };
  }
  const options = process.platform === "win32" ? windowsLoginOptions() : undefined;
  const state = app.getLoginItemSettings(options);
  return {
    enabled: process.platform === "win32"
      ? Boolean(state.executableWillLaunchAtLogin ?? state.openAtLogin)
      : Boolean(state.openAtLogin),
    status: String(state.status || (state.openAtLogin ? "enabled" : "disabled"))
  };
}

function setLoginStartup(enabled) {
  const next = Boolean(enabled);
  if (!app.isPackaged) return next;
  if (process.platform === "linux") {
    return setLinuxLoginStartup(
      next,
      app.getPath("appData"),
      linuxExecutable(process.env, process.execPath)
    );
  }
  app.setLoginItemSettings({
    openAtLogin: next,
    ...(process.platform === "win32" ? windowsLoginOptions() : {})
  });
  return loginStartupState().enabled;
}

function wasOpenedAtLogin() {
  if (process.argv.includes(hiddenLaunchArgument)) return true;
  return process.platform === "darwin"
    && app.isPackaged
    && Boolean(app.getLoginItemSettings().wasOpenedAtLogin);
}

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
  return {
    ...normalizeStoredSettings(readStoredSettings()),
    tokenError: credentialState.tokenError,
    tokenUnavailable: credentialState.tokenUnavailable,
    updateTokenError: credentialState.updateTokenError,
    updateTokenUnavailable: credentialState.updateTokenUnavailable
  };
}

async function restoreCredentials() {
  const records = readStoredSettingsCandidates();
  const reencrypted = new Map();
  const loaded = await loadStoredSettings(records.map((record) => record.value), async (encryptedToken) => {
    if (!await safeStorage.isAsyncEncryptionAvailable()) {
      throw new Error("Secure credential storage is temporarily unavailable.");
    }
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(encryptedToken, "base64"));
    if (decrypted.shouldReEncrypt) {
      reencrypted.set(
        encryptedToken,
        (await safeStorage.encryptStringAsync(decrypted.result)).toString("base64")
      );
    }
    return decrypted.result;
  });
  if (loaded.token) sessionToken = loaded.token;
  if (loaded.updateToken) sessionUpdateToken = loaded.updateToken;
  credentialState = {
    tokenError: loaded.tokenError,
    tokenUnavailable: loaded.tokenUnavailable,
    encryptedTokenPresent: loaded.encryptedTokenPresent,
    updateTokenError: loaded.updateTokenError,
    updateTokenUnavailable: loaded.updateTokenUnavailable,
    encryptedUpdateTokenPresent: loaded.encryptedUpdateTokenPresent
  };
  const primaryRecord = records[0];
  const tokenRecord = records[loaded.tokenSourceIndex];
  const updateTokenRecord = records[loaded.updateTokenSourceIndex];
  const encryptedToken = reencrypted.get(loaded.encryptedToken) || loaded.encryptedToken;
  const encryptedUpdateToken = reencrypted.get(loaded.encryptedUpdateToken) || loaded.encryptedUpdateToken;
  const needsMigration = primaryRecord
    && (primaryRecord.path !== settingsPath()
      || primaryRecord.value.schemaVersion !== 2
      || (loaded.encryptedToken && tokenRecord?.path !== settingsPath())
      || (loaded.encryptedUpdateToken && updateTokenRecord?.path !== settingsPath())
      || reencrypted.has(loaded.encryptedToken)
      || reencrypted.has(loaded.encryptedUpdateToken));
  if (needsMigration) {
    writeStoredSettings({
      ...primaryRecord.value,
      ...loaded.settings,
      ...(encryptedToken ? { apiToken: encryptedToken } : {}),
      ...(encryptedUpdateToken ? { updateToken: encryptedUpdateToken } : {})
    }, false);
  }
  return loadSettings();
}

async function saveSettings(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const workspaceSlug = String(input.workspaceSlug || "").trim();
  const memberId = String(input.memberId || "").trim();
  const memberName = String(input.memberName || "").trim();
  const assigneeIds = cleanIds(input.assigneeIds);
  const projectIds = input.projectIds === null ? null : cleanIds(input.projectIds);
  const stateNames = input.stateNames === null ? null : cleanStateNames(input.stateNames);
  const groupByProject = Boolean(input.groupByProject);
  const alwaysOnTop = Boolean(input.alwaysOnTop);
  const refreshMinutes = [0, 1, 5, 10, 15, 30].includes(Number(input.refreshMinutes))
    ? Number(input.refreshMinutes)
    : 5;
  const theme = input.theme === "dark" ? "dark" : "light";
  const priorityStyle = input.priorityStyle === "gradient" ? "gradient" : "dot";
  const currentStored = readStoredSettings();
  const current = normalizeStoredSettings(currentStored);
  const optionalFlag = (key) => (input[key] === undefined ? current[key] : Boolean(input[key]));
  const compactCards = optionalFlag("compactCards");
  const closeToTray = optionalFlag("closeToTray");
  const minimizeToTray = optionalFlag("minimizeToTray");
  const startAtLogin = optionalFlag("startAtLogin");
  const suppliedToken = String(input.apiToken || "").trim();
  const suppliedUpdateToken = String(input.updateToken || "").trim();

  if (!workspaceSlug || !memberId || !(suppliedToken || sessionToken || currentStored.apiToken)) {
    throw new Error("Workspace home address, account, and API token are required.");
  }
  if (!isUuid(memberId)) {
    throw new Error("Member ID must be the UUID from your Plane profile URL.");
  }
  if (assigneeIds.some((id) => !isUuid(id))) {
    throw new Error("Every selected member must have a valid Plane UUID.");
  }

  const stored = {
    schemaVersion: 2,
    baseUrl,
    workspaceSlug,
    memberId,
    memberName,
    assigneeIds,
    projectIds,
    stateNames,
    groupByProject,
    alwaysOnTop,
    refreshMinutes,
    theme,
    compactCards,
    priorityStyle,
    closeToTray,
    minimizeToTray,
    startAtLogin,
    setupComplete: true
  };
  stored.apiToken = currentStored.apiToken;
  stored.updateToken = currentStored.updateToken;
  if ((suppliedToken || (!stored.apiToken && sessionToken))
    && !await safeStorage.isAsyncEncryptionAvailable()) {
    throw new Error("Secure credential storage is unavailable, so Plane Pin cannot save the API token safely.");
  }
  if (suppliedToken || (!stored.apiToken && sessionToken)) {
    stored.apiToken = (await safeStorage.encryptStringAsync(suppliedToken || sessionToken)).toString("base64");
  }
  if (suppliedUpdateToken || (!stored.updateToken && sessionUpdateToken)) {
    if (!await safeStorage.isAsyncEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable, so Plane Pin cannot save the update token safely.");
    }
    stored.updateToken = (await safeStorage.encryptStringAsync(suppliedUpdateToken || sessionUpdateToken)).toString("base64");
  }
  stored.startAtLogin = setLoginStartup(startAtLogin);
  writeStoredSettings(stored);
  if (suppliedToken) sessionToken = suppliedToken;
  if (suppliedUpdateToken) sessionUpdateToken = suppliedUpdateToken;
  credentialState = {
    tokenError: suppliedToken ? false : credentialState.tokenError,
    tokenUnavailable: suppliedToken ? false : credentialState.tokenUnavailable,
    encryptedTokenPresent: Boolean(stored.apiToken),
    updateTokenError: suppliedUpdateToken ? false : credentialState.updateTokenError,
    updateTokenUnavailable: suppliedUpdateToken ? false : credentialState.updateTokenUnavailable,
    encryptedUpdateTokenPresent: Boolean(stored.updateToken)
  };
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  nativeTheme.themeSource = theme;
  refreshTray();
  if (suppliedUpdateToken) updateManager?.check();
  return {
    persistedToken: Boolean(stored.apiToken),
    persistedUpdateToken: Boolean(stored.updateToken)
  };
}

function publicSettings() {
  const settings = loadSettings();
  const loginStartup = loginStartupState();
  return {
    ...settings,
    startAtLogin: loginStartup.enabled,
    loginStartupStatus: loginStartup.status,
    tokenSet: Boolean(sessionToken || credentialState.encryptedTokenPresent),
    updateTokenSet: Boolean(sessionUpdateToken || credentialState.encryptedUpdateTokenPresent),
    updateCredentialAvailable: Boolean(sessionUpdateToken || process.env.GH_TOKEN),
    platform: process.platform,
    trayLocation: trayLocationName(process.platform),
    appVersion: app.getVersion()
  };
}

function trayImage() {
  const assets = path.join(__dirname, "renderer", "assets");
  if (process.platform === "darwin") {
    const template = nativeImage.createFromPath(path.join(assets, "trayTemplate.png"));
    template.setTemplateImage(true);
    return template;
  }
  return nativeImage.createFromPath(path.join(assets, "tray.png"));
}

function windowIsVisible() {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  refreshTray();
}

function hideWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  refreshTray();
}

function sendTrayCommand(command) {
  mainWindow?.webContents.send("tray:command", command);
}

function handleTrayCommand(id) {
  const stored = readStoredSettings();
  if (id === "show") return windowIsVisible() ? hideWindow() : showWindow();
  if (id === "quit") {
    quitting = true;
    return app.quit();
  }
  if (id === "always-on-top") {
    const alwaysOnTop = !normalizeStoredSettings(stored).alwaysOnTop;
    writeStoredSettings({ ...stored, schemaVersion: 2, alwaysOnTop });
    mainWindow?.setAlwaysOnTop(alwaysOnTop);
    sendTrayCommand("always-on-top");
    return refreshTray();
  }
  if (id === "compact-cards") {
    const compactCards = !normalizeStoredSettings(stored).compactCards;
    writeStoredSettings({ ...stored, schemaVersion: 2, compactCards });
    sendTrayCommand("compact-cards");
    return refreshTray();
  }
  showWindow();
  sendTrayCommand(id);
}

function refreshTray() {
  if (!tray || tray.isDestroyed()) return;
  const settings = normalizeStoredSettings(readStoredSettings());
  const connected = Boolean(sessionToken);
  const template = buildTrayMenuTemplate({
    windowVisible: windowIsVisible(),
    alwaysOnTop: settings.alwaysOnTop,
    compactCards: settings.compactCards,
    connected,
    platform: process.platform
  }).map((item) => (item.type === "separator" ? item : { ...item, click: () => handleTrayCommand(item.id) }));
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(trayTooltip({ connected, taskCount: lastTaskCount }));
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;
  try {
    tray = new Tray(trayImage());
  } catch (error) {
    // Some Linux desktops ship no status-notifier host. Without a tray icon,
    // hiding the window would strand the app, so the app keeps ordinary window
    // behaviour instead (see the close and minimize handlers).
    tray = null;
    console.error(`Tray icon unavailable: ${error.message}`);
    return;
  }
  tray.setIgnoreDoubleClickEvents?.(true);
  // macOS opens the menu on a plain click, so only Windows and Linux get toggle-on-click.
  if (process.platform !== "darwin") {
    tray.on("click", () => (windowIsVisible() ? hideWindow() : showWindow()));
  }
  refreshTray();
}

function createWindow({ showOnReady = true } = {}) {
  const settings = loadSettings();
  nativeTheme.themeSource = settings.theme;
  mainWindow = new BrowserWindow({
    width: 380,
    height: 650,
    minWidth: 320,
    minHeight: 420,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: settings.theme === "dark" ? "#17171a" : "#f7f7f8",
    ...windowChromeOptions(process.platform),
    show: false,
    icon: path.join(__dirname, "renderer", "assets", "app-icon.png"),
    title: "Plane Pin",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();

  // Closing and minimising park the app in the tray instead of ending it, so the
  // task rail stays one click away. Quit from the tray menu really exits.
  mainWindow.on("close", (event) => {
    if (!shouldHideToTray({
      preference: normalizeStoredSettings(readStoredSettings()).closeToTray,
      quitting,
      trayAvailable: Boolean(tray)
    })) return;
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on("minimize", (event) => {
    if (!shouldHideToTray({
      preference: normalizeStoredSettings(readStoredSettings()).minimizeToTray,
      trayAvailable: Boolean(tray)
    })) return;
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on("show", refreshTray);
  mainWindow.on("hide", refreshTray);
  mainWindow.once("ready-to-show", () => {
    if (showOnReady) mainWindow.show();
    refreshTray();
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function configureUpdateCredential() {
  if (sessionUpdateToken) process.env.GH_TOKEN = sessionUpdateToken;
}

function createUpdateService() {
  const supported = app.isPackaged && (process.platform !== "darwin" || macAutoUpdatesEnabled);
  const unsupportedMessage = app.isPackaged
    ? "Automatic macOS updates need a signed and notarised build."
    : "Update checks are available in installed builds.";
  updateManager = createUpdateManager({
    updater: autoUpdater,
    currentVersion: app.getVersion(),
    supported,
    unsupportedMessage,
    hasCredential: () => Boolean(sessionUpdateToken || process.env.GH_TOKEN),
    configureCredential: configureUpdateCredential,
    beforeInstall: () => {
      // quitAndInstall closes windows before Electron emits before-quit. Set this
      // first so close-to-tray cannot intercept the updater's restart.
      quitting = true;
    },
    notify: (state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update:state", state);
      }
    }
  });
}

ipcMain.handle("settings:get", () => publicSettings());
ipcMain.handle("settings:save", (_event, input) => saveSettings(input));
ipcMain.handle("update:get-state", () => updateManager?.getState());
ipcMain.handle("update:check", () => updateManager?.check());
ipcMain.handle("update:install", () => updateManager?.install());
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
  writeStoredSettings({ ...readStoredSettings(), schemaVersion: 2, alwaysOnTop });
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  refreshTray();
  return alwaysOnTop;
});

const booleanPreferences = new Set(["compactCards", "closeToTray", "minimizeToTray"]);

ipcMain.handle("settings:set-preference", (_event, key, value) => {
  const stored = readStoredSettings();
  if (key === "theme") {
    const theme = value === "dark" ? "dark" : "light";
    writeStoredSettings({ ...stored, schemaVersion: 2, theme });
    nativeTheme.themeSource = theme;
    mainWindow?.setBackgroundColor(theme === "dark" ? "#17171a" : "#f7f7f8");
    return theme;
  }
  if (booleanPreferences.has(key)) {
    const next = Boolean(value);
    writeStoredSettings({ ...stored, schemaVersion: 2, [key]: next });
    refreshTray();
    return next;
  }
  throw new Error("Unknown preference.");
});
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:set-compact-mode", (_event, enabled) => {
  if (process.platform === "darwin" && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setWindowButtonVisibility(!Boolean(enabled));
  }
  return Boolean(enabled);
});
// Press-and-hold anywhere in task-only mode moves the window. The renderer sends
// screen-space deltas; the main process owns the position so multi-monitor
// coordinates and the maximised guard stay in one place.
ipcMain.handle("window:drag-start", () => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) {
    dragOrigin = null;
    return false;
  }
  const [x, y] = mainWindow.getPosition();
  dragOrigin = { x, y };
  return true;
});
ipcMain.handle("window:drag-move", (_event, deltaX, deltaY) => {
  if (!dragOrigin || !mainWindow || mainWindow.isDestroyed()) return false;
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
  mainWindow.setPosition(Math.round(dragOrigin.x + deltaX), Math.round(dragOrigin.y + deltaY));
  return true;
});
ipcMain.handle("window:drag-end", () => {
  dragOrigin = null;
  return true;
});
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
  if (!sessionToken && credentialState.tokenUnavailable) await restoreCredentials();
  const settings = loadSettings();
  if (!settings.baseUrl || !settings.workspaceSlug || !settings.memberId || !sessionToken) {
    throw new Error(settings.tokenUnavailable
      ? "Your saved token is safe, but the system keyring is still locked. Unlock it and refresh."
      : "Connect Plane first.");
  }
  const tasks = await fetchAssignedTasks({ ...settings, apiToken: sessionToken });
  lastTaskCount = tasks.length;
  refreshTray();
  return tasks.map((task) => ({
    id: String(task.id),
    name: String(task.name || "Untitled work item"),
    identifier: task.project?.identifier && task.sequence_id
      ? `${task.project.identifier}-${task.sequence_id}`
      : task.sequence_id
        ? `#${task.sequence_id}`
        : "Work item",
    priority: String(task.priority || "none"),
    estimate: String(task.estimateLabel || ""),
    targetDate: task.target_date || null,
    stateName: String(task.state?.name || "Unknown state"),
    stateGroup: String(task.state?.group || "unstarted"),
    stateColor: String(task.state?.color || ""),
    projectName: String(task.project?.name || task.project?.identifier || "Project"),
    projectIdentifier: String(task.project?.identifier || ""),
    url: buildTaskUrl(settings.baseUrl, settings.workspaceSlug, task)
  }));
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A second launch reveals the running rail instead of starting a rival tray icon.
  app.on("second-instance", showWindow);

  app.whenReady().then(async () => {
    app.setAppUserModelId("com.niyalo.planepin");
    await restoreCredentials();
    createUpdateService();
    createTray();
    createWindow({ showOnReady: !wasOpenedAtLogin() || !tray });
    updateManager.check();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });
}

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => {
  tray?.destroy();
  tray = null;
});

// With a tray icon the app deliberately outlives its window on every platform.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) app.quit();
});
