"use strict";

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, nativeTheme, safeStorage, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { autoUpdater } = require("electron-updater");
const { cleanStateMappings, targetForState } = require("./renderer/completion-model");
const {
  hiddenLaunchArgument,
  linuxExecutable,
  linuxLoginStartupState,
  macLoginStartupState,
  setLinuxLoginStartup,
  windowsLoginStartupState
} = require("./login-startup");
const {
  buildTaskUrl,
  discoverWorkspace,
  fetchAssignedTasks,
  isMemberFilterId,
  isUuid,
  normalizeBaseUrl,
  taskAssignees,
  updateTaskState
} = require("./plane-client");
const { cleanIds, cleanOrder, cleanStateNames, loadStoredSettings, normalizeStoredSettings } = require("./settings-model");
const { buildTrayMenuTemplate, trayLocationName, trayTooltip } = require("./tray-menu");
const { createUpdateManager } = require("./update-manager");
const { shouldHideToTray, windowChromeOptions } = require("./window-behavior");

let mainWindow;
let settingsWindow;
let tray;
let sessionToken = "";
let credentialState = {
  tokenError: false,
  tokenUnavailable: false,
  encryptedTokenPresent: false
};
let updateManager;
let quitting = false;
let dragOrigin = null;
let lastTaskCount = 0;
let lastTaskRefs = new Map();
const pendingTaskUndos = new Map();
const celebrationWindows = new Set();
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
  const requested = normalizeStoredSettings(readStoredSettings()).startAtLogin;
  if (!app.isPackaged) {
    return {
      requested,
      registered: false,
      effective: null,
      status: "development"
    };
  }
  try {
    if (process.platform === "linux") {
      return {
        requested,
        ...linuxLoginStartupState(
          app.getPath("appData"),
          linuxExecutable(process.env, process.execPath)
        )
      };
    }
    if (process.platform === "win32") {
      return windowsLoginStartupState(
        app.getLoginItemSettings(windowsLoginOptions()),
        process.execPath,
        requested
      );
    }
    return macLoginStartupState(app.getLoginItemSettings(), requested);
  } catch (error) {
    return {
      requested,
      registered: null,
      effective: null,
      status: "error",
      error: error.message
    };
  }
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
  return next;
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

async function credentialEncryptionAvailable() {
  return process.platform === "linux"
    ? safeStorage.isAsyncEncryptionAvailable()
    : safeStorage.isEncryptionAvailable();
}

async function encryptCredential(value) {
  return process.platform === "linux"
    ? safeStorage.encryptStringAsync(value)
    : safeStorage.encryptString(value);
}

async function decryptCredential(value) {
  if (process.platform === "linux") return safeStorage.decryptStringAsync(value);
  return { result: safeStorage.decryptString(value), shouldReEncrypt: false };
}

function loadSettings() {
  return {
    ...normalizeStoredSettings(readStoredSettings()),
    tokenError: credentialState.tokenError,
    tokenUnavailable: credentialState.tokenUnavailable
  };
}

async function restoreCredentials() {
  const records = readStoredSettingsCandidates();
  const reencrypted = new Map();
  const loaded = await loadStoredSettings(records.map((record) => record.value), async (encryptedToken) => {
    if (!await credentialEncryptionAvailable()) {
      throw new Error("Secure credential storage is temporarily unavailable.");
    }
    const decrypted = await decryptCredential(Buffer.from(encryptedToken, "base64"));
    if (decrypted.shouldReEncrypt) {
      reencrypted.set(
        encryptedToken,
        (await encryptCredential(decrypted.result)).toString("base64")
      );
    }
    return decrypted.result;
  });
  if (loaded.token) sessionToken = loaded.token;
  credentialState = {
    tokenError: loaded.tokenError,
    tokenUnavailable: loaded.tokenUnavailable,
    encryptedTokenPresent: loaded.encryptedTokenPresent
  };
  const primaryRecord = records[0];
  const tokenRecord = records[loaded.tokenSourceIndex];
  const encryptedToken = reencrypted.get(loaded.encryptedToken)
    || loaded.encryptedToken
    || records.find((record) => record.value.apiToken)?.value.apiToken;
  const needsMigration = primaryRecord
    && (primaryRecord.path !== settingsPath()
      || primaryRecord.value.schemaVersion !== 4
      || (loaded.encryptedToken && tokenRecord?.path !== settingsPath())
      || reencrypted.has(loaded.encryptedToken)
      || Boolean(primaryRecord.value.updateToken));
  if (needsMigration) {
    writeStoredSettings({
      ...loaded.settings,
      ...(encryptedToken ? { apiToken: encryptedToken } : {})
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
  const memberOrder = cleanOrder(input.memberOrder);
  const projectOrder = cleanOrder(input.projectOrder);
  const stateOrder = cleanOrder(input.stateOrder);
  const groupByProject = Boolean(input.groupByProject);
  const groupByMember = Boolean(input.groupByMember);
  const changeOnCheck = Boolean(input.changeOnCheck);
  const checkStateMappings = cleanStateMappings(input.checkStateMappings);
  const checkTargetStateName = String(input.checkTargetStateName || "").trim().slice(0, 100);
  const completionSound = input.completionSound !== false;
  const alwaysOnTop = Boolean(input.alwaysOnTop);
  const refreshMinutes = [0, 1, 5, 10, 15, 30].includes(Number(input.refreshMinutes))
    ? Number(input.refreshMinutes)
    : 5;
  const theme = input.theme === "dark" ? "dark" : "light";
  const priorityStyle = input.priorityStyle === "gradient" ? "gradient" : "dot";
  const currentStored = readStoredSettings();
  const current = normalizeStoredSettings(currentStored);
  const collapsedGroupKeys = input.collapsedGroupKeys === undefined
    ? current.collapsedGroupKeys
    : cleanOrder(input.collapsedGroupKeys);
  const optionalFlag = (key) => (input[key] === undefined ? current[key] : Boolean(input[key]));
  const compactCards = optionalFlag("compactCards");
  const closeToTray = optionalFlag("closeToTray");
  const minimizeToTray = optionalFlag("minimizeToTray");
  const startAtLogin = optionalFlag("startAtLogin");
  const suppliedToken = String(input.apiToken || "").trim();

  if (!workspaceSlug || !memberId || !(suppliedToken || sessionToken || currentStored.apiToken)) {
    throw new Error("Workspace home address, account, and API token are required.");
  }
  if (!isUuid(memberId)) {
    throw new Error("Member ID must be the UUID from your Plane profile URL.");
  }
  if ([...assigneeIds, ...memberOrder].some((id) => !isMemberFilterId(id))) {
    throw new Error("Every saved member must have a valid Plane UUID or be Unassigned.");
  }
  if (projectOrder.some((id) => !isUuid(id))) {
    throw new Error("Every saved project must have a valid Plane UUID.");
  }
  const stored = {
    schemaVersion: 4,
    baseUrl,
    workspaceSlug,
    memberId,
    memberName,
    assigneeIds,
    projectIds,
    stateNames,
    memberOrder,
    projectOrder,
    stateOrder,
    collapsedGroupKeys,
    groupByProject,
    groupByMember,
    changeOnCheck,
    checkStateMappings,
    checkTargetStateName,
    completionSound,
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
  if ((suppliedToken || (!stored.apiToken && sessionToken))
    && !await credentialEncryptionAvailable()) {
    throw new Error("Secure credential storage is unavailable, so Plane Pin cannot save the API token safely.");
  }
  if (suppliedToken || (!stored.apiToken && sessionToken)) {
    stored.apiToken = (await encryptCredential(suppliedToken || sessionToken)).toString("base64");
  }
  if (input.startAtLogin !== undefined) setLoginStartup(startAtLogin);
  stored.startAtLogin = startAtLogin;
  writeStoredSettings(stored);
  if (suppliedToken) sessionToken = suppliedToken;
  credentialState = {
    tokenError: suppliedToken ? false : credentialState.tokenError,
    tokenUnavailable: suppliedToken ? false : credentialState.tokenUnavailable,
    encryptedTokenPresent: Boolean(stored.apiToken)
  };
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  settingsWindow?.setAlwaysOnTop(alwaysOnTop);
  nativeTheme.themeSource = theme;
  settingsWindow?.setBackgroundColor(theme === "dark" ? "#17171a" : "#f7f7f8");
  refreshTray();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings:changed", publicSettings());
  }
  return {
    persistedToken: Boolean(stored.apiToken)
  };
}

function publicSettings() {
  const settings = loadSettings();
  const loginStartup = loginStartupState();
  return {
    ...settings,
    startAtLogin: loginStartup.requested,
    loginStartup,
    loginStartupRequested: loginStartup.requested,
    loginStartupRegistered: loginStartup.registered,
    loginStartupEffective: loginStartup.effective,
    loginStartupStatus: loginStartup.status,
    tokenSet: Boolean(sessionToken || credentialState.encryptedTokenPresent),
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
    writeStoredSettings({ ...stored, schemaVersion: 4, alwaysOnTop });
    mainWindow?.setAlwaysOnTop(alwaysOnTop);
    settingsWindow?.setAlwaysOnTop(alwaysOnTop);
    sendTrayCommand("always-on-top");
    return refreshTray();
  }
  if (id === "compact-cards") {
    const compactCards = !normalizeStoredSettings(stored).compactCards;
    writeStoredSettings({ ...stored, schemaVersion: 4, compactCards });
    sendTrayCommand("compact-cards");
    return refreshTray();
  }
  if (id === "settings") return openSettingsWindow();
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

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    return true;
  }
  const settings = loadSettings();
  settingsWindow = new BrowserWindow({
    width: 580,
    height: 760,
    minWidth: 420,
    minHeight: 520,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: settings.theme === "dark" ? "#17171a" : "#f7f7f8",
    icon: path.join(__dirname, "renderer", "assets", "app-icon.png"),
    title: "Plane Pin Settings",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.removeMenu();
  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
  settingsWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    settingsWindow.hide();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  settingsWindow.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: { view: "settings" }
  });
  return true;
}

function showCelebration(input) {
  const screenX = Number(input?.screenX);
  const screenY = Number(input?.screenY);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return false;
  const display = screen.getDisplayNearestPoint({
    x: Math.round(screenX),
    y: Math.round(screenY)
  });
  const { x, y, width, height } = display.bounds;
  const overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  celebrationWindows.add(overlay);
  overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.once("ready-to-show", () => overlay.showInactive());
  overlay.on("closed", () => celebrationWindows.delete(overlay));
  overlay.loadFile(path.join(__dirname, "renderer", "confetti.html"), {
    query: {
      x: String(screenX - x),
      y: String(screenY - y)
    }
  });
  const safety = setTimeout(() => {
    if (!overlay.isDestroyed()) overlay.destroy();
  }, 20_000);
  safety.unref?.();
  return true;
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
ipcMain.handle("window:open-settings", openSettingsWindow);
ipcMain.handle("window:close-settings", () => settingsWindow?.hide());
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
  writeStoredSettings({ ...readStoredSettings(), schemaVersion: 4, alwaysOnTop });
  mainWindow?.setAlwaysOnTop(alwaysOnTop);
  settingsWindow?.setAlwaysOnTop(alwaysOnTop);
  refreshTray();
  return alwaysOnTop;
});

const booleanPreferences = new Set(["compactCards", "closeToTray", "minimizeToTray"]);

ipcMain.handle("settings:set-preference", (_event, key, value) => {
  const stored = readStoredSettings();
  if (key === "theme") {
    const theme = value === "dark" ? "dark" : "light";
    writeStoredSettings({ ...stored, schemaVersion: 4, theme });
    nativeTheme.themeSource = theme;
    mainWindow?.setBackgroundColor(theme === "dark" ? "#17171a" : "#f7f7f8");
    settingsWindow?.setBackgroundColor(theme === "dark" ? "#17171a" : "#f7f7f8");
    return theme;
  }
  if (booleanPreferences.has(key)) {
    const next = Boolean(value);
    writeStoredSettings({ ...stored, schemaVersion: 4, [key]: next });
    refreshTray();
    return next;
  }
  if (key === "collapsedGroupKeys") {
    const collapsedGroupKeys = cleanOrder(value);
    writeStoredSettings({ ...stored, schemaVersion: 4, collapsedGroupKeys });
    return collapsedGroupKeys;
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
ipcMain.handle("task:change-state", async (_event, input) => {
  if (!sessionToken && credentialState.tokenUnavailable) await restoreCredentials();
  const settings = loadSettings();
  if (!settings.changeOnCheck || !sessionToken) {
    throw new Error("Turn on Change on check in Settings first.");
  }
  const taskId = String(input?.taskId || "");
  const projectId = String(input?.projectId || "");
  const taskRef = lastTaskRefs.get(taskId);
  if (!taskRef || taskRef.projectId !== projectId) {
    throw new Error("Refresh the task list before changing this task.");
  }
  const targetStateName = targetForState(
    settings.checkStateMappings,
    taskRef.stateName,
    settings.checkTargetStateName
  );
  if (!targetStateName) {
    throw new Error(`No checkmark change is configured for "${taskRef.stateName}".`);
  }
  const result = await updateTaskState({
    ...settings,
    apiToken: sessionToken,
    projectId,
    taskId,
    stateName: targetStateName
  });
  const undoToken = randomUUID();
  pendingTaskUndos.set(undoToken, {
    projectId,
    stateName: taskRef.stateName,
    taskId
  });
  lastTaskRefs.set(taskId, { projectId, stateName: result.stateName });
  const cleanup = setTimeout(() => pendingTaskUndos.delete(undoToken), 15 * 60_000);
  cleanup.unref?.();
  return { ...result, undoToken };
});
ipcMain.handle("celebration:show", (_event, input) => showCelebration(input));
ipcMain.on("celebration:complete", (event) => {
  const overlay = BrowserWindow.fromWebContents(event.sender);
  if (overlay && celebrationWindows.has(overlay) && !overlay.isDestroyed()) overlay.destroy();
});
ipcMain.handle("task:undo-state", async (_event, input) => {
  if (!sessionToken && credentialState.tokenUnavailable) await restoreCredentials();
  const undoToken = String(input?.undoToken || "");
  const pending = pendingTaskUndos.get(undoToken);
  if (!pending || !sessionToken) {
    throw new Error("This Undo action is no longer available.");
  }
  const result = await updateTaskState({
    ...loadSettings(),
    apiToken: sessionToken,
    projectId: pending.projectId,
    taskId: pending.taskId,
    stateName: pending.stateName
  });
  pendingTaskUndos.delete(undoToken);
  lastTaskRefs.set(pending.taskId, {
    projectId: pending.projectId,
    stateName: result.stateName
  });
  return result;
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
  lastTaskRefs = new Map(tasks.map((task) => [String(task.id), {
    projectId: String(task.project?.id || ""),
    stateName: String(task.state?.name || "")
  }]));
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
    assignees: taskAssignees(task),
    projectId: String(task.project?.id || ""),
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
      if (!mainWindow || mainWindow.isDestroyed()) createWindow();
      else showWindow();
    });
  });
}

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => {
  for (const overlay of celebrationWindows) overlay.destroy();
  celebrationWindows.clear();
  tray?.destroy();
  tray = null;
});

// With a tray icon the app deliberately outlives its window on every platform.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) app.quit();
});
