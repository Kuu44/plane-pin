"use strict";

const $ = (selector) => document.querySelector(selector);
const elements = {
  pinToggle: $("#pin-toggle"),
  pinLabel: $("#pin-label"),
  themeToggle: $("#theme-toggle"),
  compactToggle: $("#compact-toggle"),
  compactHint: $("#compact-hint"),
  status: $("#status"),
  count: $("#count"),
  listTitle: $("#list-title"),
  refresh: $("#refresh"),
  settingsOpen: $("#settings-open"),
  empty: $("#empty"),
  taskList: $("#task-list"),
  setup: $("#setup"),
  setupForm: $("#setup-form"),
  setupTitle: $("#setup-title"),
  setupProgress: $("#setup-progress"),
  setupClose: $("#setup-close"),
  setupLater: $("#setup-later"),
  setupBack: $("#setup-back"),
  setupNext: $("#setup-next"),
  setupError: $("#setup-error"),
  planePageUrl: $("#plane-page-url"),
  apiToken: $("#api-token"),
  tokenVisibility: $("#token-visibility"),
  memberSummary: $("#member-summary"),
  memberFallback: $("#member-fallback"),
  profileUrl: $("#profile-url"),
  projectAll: $("#project-all"),
  projectSingle: $("#project-single"),
  projectSelectField: $("#project-select-field"),
  projectId: $("#project-id"),
  stateAll: $("#state-all"),
  stateSelected: $("#state-selected"),
  stateOptions: $("#state-options"),
  groupByProject: $("#group-by-project"),
  preferOnTop: $("#prefer-on-top"),
  settingsDialog: $("#settings-dialog"),
  settingsForm: $("#settings-form"),
  settingsClose: $("#settings-close"),
  settingsCancel: $("#settings-cancel"),
  settingsSave: $("#settings-save"),
  settingsError: $("#settings-error"),
  settingsPlaneUrl: $("#settings-plane-url"),
  settingsToken: $("#settings-token"),
  settingsTokenVisibility: $("#settings-token-visibility"),
  settingsTokenNote: $("#settings-token-note"),
  settingsTest: $("#settings-test"),
  settingsConnectionStatus: $("#settings-connection-status"),
  settingsProfileField: $("#settings-profile-field"),
  settingsProfileUrl: $("#settings-profile-url"),
  settingsProjectAll: $("#settings-project-all"),
  settingsProjectSingle: $("#settings-project-single"),
  settingsProjectField: $("#settings-project-field"),
  settingsProjectId: $("#settings-project-id"),
  settingsStateAll: $("#settings-state-all"),
  settingsStateSelected: $("#settings-state-selected"),
  settingsStateOptions: $("#settings-state-options"),
  settingsGroupProject: $("#settings-group-project"),
  settingsOnTop: $("#settings-on-top"),
  settingsCompactCards: $("#settings-compact-cards"),
  settingsCloseTray: $("#settings-close-tray"),
  settingsMinimizeTray: $("#settings-minimize-tray"),
  settingsRefreshMinutes: $("#settings-refresh-minutes"),
  settingsThemeLight: $("#settings-theme-light"),
  settingsThemeDark: $("#settings-theme-dark")
};

const stepTitles = [
  "Bring your Plane work closer",
  "Where is your Plane workspace?",
  "Connect Plane securely",
  "Choose your projects",
  "Filter by workflow state",
  "Your viewing preferences"
];
const stepActions = ["Get started", "Continue", "Test connection", "Continue", "Continue", "Save and show my tasks"];
const stateGroupLabels = {
  backlog: "Backlog",
  unstarted: "Not started",
  started: "Started",
  completed: "Completed",
  cancelled: "Cancelled"
};
const stateGroupColors = {
  backlog: "#60646c",
  unstarted: "#60646c",
  started: "#f59e0b",
  completed: "#46a758",
  cancelled: "#9aa4bc"
};
const groupOrder = ["backlog", "unstarted", "started", "completed", "cancelled"];

let settings;
let discovery;
let settingsDiscovery;
let setupStep = 0;
let compactMode = false;
let refreshing = false;
let compactHintTimer;
let refreshTimer;
let connectionDraft = { baseUrl: "", workspaceSlug: "" };
let draftStateNames = [];
let settingsDraftStateNames = [];
const windowDrag = window.planePinDrag.createDragTracker();
let suppressNextClick = false;
let dragFrame = 0;
let pendingDrag = null;
let isMac = false;

// macOS users press Command where Windows and Linux users press Control.
const modifierLabel = () => (isMac ? "⌘" : "Ctrl");
const modifierHeld = (event) => (isMac ? event.metaKey : event.ctrlKey);

function localiseShortcutLabels() {
  if (!isMac) return;
  for (const element of document.querySelectorAll("[data-tooltip]")) {
    element.dataset.tooltip = element.dataset.tooltip.replace(/Ctrl\+/g, "⌘");
  }
  for (const element of document.querySelectorAll("[aria-keyshortcuts]")) {
    element.setAttribute(
      "aria-keyshortcuts",
      element.getAttribute("aria-keyshortcuts").replace(/Control\+/g, "Meta+")
    );
  }
}

function parsePlanePageUrl(value) {
  const url = new URL(String(value).trim());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Plane must use an HTTPS address.");
  }
  const workspaceSlug = url.pathname.split("/").filter(Boolean)[0];
  if (!workspaceSlug) throw new Error("Paste a Plane page that includes your workspace name.");
  return { baseUrl: url.origin, workspaceSlug };
}

function memberIdFromProfile(value) {
  const match = String(value).match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0] || "";
}

function applyTheme(theme) {
  settings.theme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = settings.theme;
  const dark = settings.theme === "dark";
  elements.themeToggle.setAttribute("aria-label", dark ? "Use light theme" : "Use dark theme");
  elements.themeToggle.dataset.tooltip = `${dark ? "Light" : "Dark"} theme · ${modifierLabel()}Shift+D`;
  elements.settingsThemeLight.checked = !dark;
  elements.settingsThemeDark.checked = dark;
}

async function toggleTheme() {
  const theme = settings.theme === "dark" ? "light" : "dark";
  applyTheme(await window.planePin.setPreference("theme", theme));
}

function setPinVisual(enabled) {
  elements.pinToggle.setAttribute("aria-pressed", String(enabled));
  elements.pinLabel.textContent = enabled ? "On top" : "Normal window";
  elements.pinToggle.dataset.tooltip = `${enabled ? "Turn off always on top" : "Keep above other apps"} · ${modifierLabel()}Shift+T`;
}

async function togglePin() {
  const enabled = elements.pinToggle.getAttribute("aria-pressed") !== "true";
  settings.alwaysOnTop = await window.planePin.setAlwaysOnTop(enabled);
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  setPinVisual(settings.alwaysOnTop);
}

function setCompactMode(enabled) {
  compactMode = enabled;
  document.body.classList.toggle("compact-mode", enabled);
  window.planePin.setWindowCompactMode(enabled);
  elements.compactToggle.setAttribute("aria-label", enabled ? "Show controls" : "Hide controls");
  elements.compactToggle.dataset.tooltip = `${enabled ? "Show controls" : "Hide controls"} · ${modifierLabel()}Shift+H`;
  if (enabled) {
    clearTimeout(compactHintTimer);
    elements.compactHint.classList.add("show");
    compactHintTimer = setTimeout(() => elements.compactHint.classList.remove("show"), 2800);
  } else {
    elements.compactHint.classList.remove("show");
  }
}

function applyCompactCards(enabled) {
  settings.compactCards = Boolean(enabled);
  document.body.classList.toggle("compact-cards", settings.compactCards);
  elements.settingsCompactCards.checked = settings.compactCards;
}

// Press and hold anywhere in task-only mode to move the window, the way the
// title bar behaves when the chrome is visible. Movement under the threshold
// stays a click, so tapping a card still opens it in Plane.
function beginWindowDrag(event) {
  suppressNextClick = false;
  if (!compactMode || event.button !== 0) return;
  if (elements.setup.open || elements.settingsDialog.open) return;
  if (!windowDrag.start(event.screenX, event.screenY)) return;
  window.planePin.startWindowDrag();
}

function continueWindowDrag(event) {
  if (!windowDrag.isActive()) return;
  const delta = windowDrag.move(event.screenX, event.screenY);
  if (!delta) return;
  document.body.classList.add("is-dragging-window");
  // One move per frame: pointer events outrun the window manager otherwise.
  pendingDrag = delta;
  if (dragFrame) return;
  dragFrame = requestAnimationFrame(() => {
    dragFrame = 0;
    window.planePin.moveWindowBy(pendingDrag.deltaX, pendingDrag.deltaY);
  });
}

function finishWindowDrag() {
  if (!windowDrag.isActive()) return;
  const { dragged } = windowDrag.end();
  suppressNextClick = dragged;
  if (dragFrame) {
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
  }
  if (dragged && pendingDrag) window.planePin.moveWindowBy(pendingDrag.deltaX, pendingDrag.deltaY);
  pendingDrag = null;
  document.body.classList.remove("is-dragging-window");
  window.planePin.endWindowDrag();
}

function selectedValues(container) {
  return [...container.querySelectorAll("input:checked")].map((input) => input.value);
}

function relevantProjects(source, single, projectId) {
  if (!source) return [];
  return single ? source.projects.filter((project) => project.id === projectId) : source.projects;
}

function availableStates(source, single, projectId) {
  const states = new Map();
  for (const project of relevantProjects(source, single, projectId)) {
    for (const state of project.states) {
      const key = state.name.toLocaleLowerCase();
      if (!states.has(key)) states.set(key, state);
    }
  }
  return [...states.values()].sort((left, right) => {
    const groupDifference = groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group);
    return groupDifference || left.name.localeCompare(right.name);
  });
}

function stateGlyph(group, color) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.classList.add("state-glyph");
  svg.style.setProperty("--state-color", /^#[0-9a-f]{6}$/i.test(color) ? color : stateGroupColors[group] || stateGroupColors.unstarted);

  if (group === "completed" || group === "cancelled") {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "6.5");
    circle.setAttribute("class", "state-fill");
    const mark = document.createElementNS(namespace, "path");
    mark.setAttribute("class", "state-mark");
    mark.setAttribute("d", group === "completed" ? "m4.8 8.2 2 2 4.5-4.7" : "m5.5 5.5 5 5m0-5-5 5");
    svg.append(circle, mark);
    return svg;
  }

  const circle = document.createElementNS(namespace, "circle");
  circle.setAttribute("cx", "8");
  circle.setAttribute("cy", "8");
  circle.setAttribute("r", "5.7");
  circle.setAttribute("class", "state-ring");
  if (group === "backlog") circle.setAttribute("stroke-dasharray", "1.4 2");
  svg.append(circle);
  if (group === "started") {
    const inner = document.createElementNS(namespace, "circle");
    inner.setAttribute("cx", "8");
    inner.setAttribute("cy", "8");
    inner.setAttribute("r", "2.3");
    inner.setAttribute("class", "state-ring");
    svg.append(inner);
  }
  return svg;
}

function renderStateRows(container, states, selectedNames, onChange) {
  const selected = new Set(selectedNames.map((name) => name.toLocaleLowerCase()));
  const rows = states.map((state) => {
    const label = document.createElement("label");
    label.className = "state-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = state.name;
    input.checked = selected.has(state.name.toLocaleLowerCase());
    input.addEventListener("change", onChange);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = state.name;
    const group = document.createElement("small");
    group.textContent = stateGroupLabels[state.group] || "Workflow state";
    copy.append(name, group);
    label.append(input, stateGlyph(state.group, state.color), copy);
    return label;
  });
  container.replaceChildren(...rows);
}

function populateProjectSelect(select, source, selectedProjectId) {
  const options = (source?.projects || []).map((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.identifier ? `${project.identifier} — ${project.name}` : project.name;
    return option;
  });
  select.replaceChildren(...options);
  const selectedProject = source?.projects.find((project) =>
    project.id === selectedProjectId
    || project.identifier.toLocaleLowerCase() === String(selectedProjectId || "").toLocaleLowerCase()
  );
  if (selectedProject) select.value = selectedProject.id;
}

function renderOnboardingStates() {
  renderStateRows(
    elements.stateOptions,
    availableStates(discovery, elements.projectSingle.checked, elements.projectId.value),
    draftStateNames,
    () => {
      draftStateNames = selectedValues(elements.stateOptions);
    }
  );
  elements.stateOptions.hidden = !elements.stateSelected.checked;
}

function updateOnboardingProjectChoice() {
  elements.projectSelectField.hidden = !elements.projectSingle.checked;
  if (setupStep === 4) renderOnboardingStates();
}

function showStep(nextStep) {
  setupStep = nextStep;
  for (const panel of document.querySelectorAll(".setup-step")) {
    const active = Number(panel.dataset.step) === setupStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  elements.setupTitle.textContent = stepTitles[setupStep];
  elements.setupProgress.textContent = setupStep === 0 ? "Welcome" : `Step ${setupStep} of 5`;
  elements.setupNext.textContent = stepActions[setupStep];
  elements.setupBack.hidden = setupStep === 0;
  elements.setupError.textContent = "";
  requestAnimationFrame(() => {
    const input = $(`.setup-step[data-step="${setupStep}"] input:not([type="radio"]):not([type="checkbox"])`);
    (input || elements.setupNext).focus();
  });
}

function openOnboarding() {
  discovery = null;
  draftStateNames = [...(settings.stateNames || [])];
  connectionDraft = { baseUrl: settings.baseUrl || "", workspaceSlug: settings.workspaceSlug || "" };
  elements.planePageUrl.value = settings.baseUrl && settings.workspaceSlug
    ? `${settings.baseUrl}/${settings.workspaceSlug}/`
    : "";
  elements.apiToken.value = "";
  elements.apiToken.type = "password";
  elements.tokenVisibility.textContent = "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", "false");
  elements.profileUrl.value = settings.memberId ? `/profile/${settings.memberId}/assigned/` : "";
  elements.projectAll.checked = settings.projectScope !== "single";
  elements.projectSingle.checked = settings.projectScope === "single";
  elements.stateAll.checked = settings.stateFilterMode !== "selected";
  elements.stateSelected.checked = settings.stateFilterMode === "selected";
  elements.groupByProject.checked = settings.groupByProject;
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.memberFallback.hidden = true;
  updateOnboardingProjectChoice();
  showStep(0);
  if (!elements.setup.open) elements.setup.showModal();
}

async function advanceSetup() {
  if (setupStep === 0) return showStep(1);
  if (setupStep === 1) {
    try {
      connectionDraft = parsePlanePageUrl(elements.planePageUrl.value);
      showStep(2);
    } catch (error) {
      elements.setupError.textContent = error.message;
    }
    return;
  }
  if (setupStep === 2) {
    elements.setupNext.disabled = true;
    elements.setupNext.textContent = "Checking…";
    try {
      discovery = await window.planePin.discoverWorkspace({ ...connectionDraft, apiToken: elements.apiToken.value });
      populateProjectSelect(elements.projectId, discovery, settings.projectId);
      const member = discovery.member || (settings.memberId ? {
        id: settings.memberId,
        name: settings.memberName || "your saved Plane account"
      } : null);
      elements.memberSummary.textContent = member
        ? `Connected as ${member.name}. We found ${discovery.projects.length} ${discovery.projects.length === 1 ? "project" : "projects"}.`
        : `Connection works. We found ${discovery.projects.length} projects, but this Plane version needs your My Work link.`;
      elements.memberFallback.hidden = Boolean(member);
      updateOnboardingProjectChoice();
      showStep(3);
    } catch (error) {
      elements.setupError.textContent = error.message;
    } finally {
      elements.setupNext.disabled = false;
      if (setupStep === 2) elements.setupNext.textContent = stepActions[2];
    }
    return;
  }
  if (setupStep === 3) {
    if (!discovery) return showStep(2);
    if (elements.projectSingle.checked && !elements.projectId.value) {
      elements.setupError.textContent = "Choose a project.";
      return;
    }
    if (!discovery.member?.id && !settings.memberId && !memberIdFromProfile(elements.profileUrl.value)) {
      elements.setupError.textContent = "Paste your My Work page address so Plane Pin can identify your account.";
      return;
    }
    renderOnboardingStates();
    showStep(4);
    return;
  }
  if (setupStep === 4) {
    draftStateNames = selectedValues(elements.stateOptions);
    if (elements.stateSelected.checked && draftStateNames.length === 0) {
      elements.setupError.textContent = "Select at least one state or choose All states.";
      return;
    }
    showStep(5);
    return;
  }

  elements.setupNext.disabled = true;
  elements.setupNext.textContent = "Saving…";
  try {
    const member = discovery.member || {
      id: settings.memberId || memberIdFromProfile(elements.profileUrl.value),
      name: settings.memberName || ""
    };
    await window.planePin.saveSettings({
      ...connectionDraft,
      apiToken: elements.apiToken.value,
      memberId: member.id,
      memberName: member.name,
      projectScope: elements.projectSingle.checked ? "single" : "all",
      projectId: elements.projectSingle.checked ? elements.projectId.value : "",
      stateFilterMode: elements.stateSelected.checked ? "selected" : "all",
      stateNames: elements.stateSelected.checked ? draftStateNames : [],
      groupByProject: elements.groupByProject.checked,
      alwaysOnTop: elements.preferOnTop.checked,
      refreshMinutes: 5,
      theme: settings.theme
    });
    settings = await window.planePin.getSettings();
    applySettingsToShell();
    elements.setup.close();
    scheduleAutoRefresh();
    await refreshTasks();
  } catch (error) {
    elements.setupError.textContent = error.message;
  } finally {
    elements.setupNext.disabled = false;
    elements.setupNext.textContent = stepActions[5];
  }
}

function updateSettingsProjectChoice() {
  elements.settingsProjectField.hidden = !elements.settingsProjectSingle.checked;
  renderSettingsStates();
}

function renderSettingsStates() {
  const states = settingsDiscovery
    ? availableStates(settingsDiscovery, elements.settingsProjectSingle.checked, elements.settingsProjectId.value)
    : settingsDraftStateNames.map((name) => ({ name, group: "", color: "" }));
  renderStateRows(elements.settingsStateOptions, states, settingsDraftStateNames, () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
  });
  elements.settingsStateOptions.hidden = !elements.settingsStateSelected.checked;
}

function applySettingsDiscovery(result) {
  settingsDiscovery = result;
  populateProjectSelect(elements.settingsProjectId, settingsDiscovery, settings.projectId);
  const member = settingsDiscovery.member || (settings.memberId ? {
    id: settings.memberId,
    name: settings.memberName || "saved Plane account"
  } : null);
  elements.settingsConnectionStatus.textContent = member
    ? `Connected as ${member.name} · ${result.projects.length} ${result.projects.length === 1 ? "project" : "projects"}`
    : `Connected · ${result.projects.length} projects · My Work link required`;
  elements.settingsConnectionStatus.className = "connection-ok";
  elements.settingsProfileField.hidden = Boolean(member);
  updateSettingsProjectChoice();
}

async function testSettingsConnection() {
  elements.settingsError.textContent = "";
  elements.settingsTest.disabled = true;
  elements.settingsTest.textContent = "Testing…";
  elements.settingsConnectionStatus.textContent = "";
  try {
    const connection = parsePlanePageUrl(elements.settingsPlaneUrl.value);
    applySettingsDiscovery(await window.planePin.discoverWorkspace({
      ...connection,
      apiToken: elements.settingsToken.value
    }));
    return connection;
  } catch (error) {
    settingsDiscovery = null;
    elements.settingsConnectionStatus.textContent = error.message;
    elements.settingsConnectionStatus.className = "connection-error";
    throw error;
  } finally {
    elements.settingsTest.disabled = false;
    elements.settingsTest.textContent = "Test connection";
  }
}

function hydrateSettingsForm() {
  settingsDiscovery = null;
  settingsDraftStateNames = [...settings.stateNames];
  elements.settingsPlaneUrl.value = settings.baseUrl && settings.workspaceSlug
    ? `${settings.baseUrl}/${settings.workspaceSlug}/`
    : "";
  elements.settingsToken.value = "";
  elements.settingsToken.type = "password";
  elements.settingsTokenVisibility.textContent = "Show";
  elements.settingsTokenVisibility.setAttribute("aria-pressed", "false");
  elements.settingsToken.placeholder = settings.tokenSet ? "Saved securely — enter only to replace" : "Enter a Plane API token";
  elements.settingsTokenNote.textContent = settings.tokenError
    ? "Windows could not unlock the saved token. Enter it again, then save."
    : "Leave blank to keep the encrypted token already saved.";
  elements.settingsProfileUrl.value = settings.memberId ? `/profile/${settings.memberId}/assigned/` : "";
  elements.settingsProfileField.hidden = Boolean(settings.memberId);
  elements.settingsProjectAll.checked = settings.projectScope !== "single";
  elements.settingsProjectSingle.checked = settings.projectScope === "single";
  elements.settingsProjectField.hidden = !elements.settingsProjectSingle.checked;
  elements.settingsStateAll.checked = settings.stateFilterMode !== "selected";
  elements.settingsStateSelected.checked = settings.stateFilterMode === "selected";
  elements.settingsGroupProject.checked = settings.groupByProject;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  elements.settingsCompactCards.checked = settings.compactCards;
  elements.settingsCloseTray.checked = settings.closeToTray;
  elements.settingsMinimizeTray.checked = settings.minimizeToTray;
  elements.settingsRefreshMinutes.value = String(settings.refreshMinutes);
  elements.settingsThemeLight.checked = settings.theme !== "dark";
  elements.settingsThemeDark.checked = settings.theme === "dark";
  elements.settingsConnectionStatus.textContent = settings.memberName
    ? `Saved account: ${settings.memberName}`
    : settings.setupComplete
      ? "Saved connection"
      : "Not connected";
  elements.settingsConnectionStatus.className = "";
  renderSettingsStates();
}

async function openSettings() {
  hydrateSettingsForm();
  elements.settingsError.textContent = "";
  if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
  requestAnimationFrame(() => elements.settingsPlaneUrl.focus());
  if (settings.tokenSet && !settings.tokenError) {
    try {
      await testSettingsConnection();
    } catch {
      // The visible inline result is enough; the form remains fully editable.
    }
  }
}

async function saveSettingsForm() {
  elements.settingsError.textContent = "";
  elements.settingsSave.disabled = true;
  elements.settingsSave.textContent = "Saving…";
  try {
    const connection = parsePlanePageUrl(elements.settingsPlaneUrl.value);
    const connectionChanged = connection.baseUrl !== settings.baseUrl
      || connection.workspaceSlug !== settings.workspaceSlug
      || Boolean(elements.settingsToken.value);
    if (connectionChanged || (!settingsDiscovery && !settings.memberId)) {
      await testSettingsConnection();
    }
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    if (elements.settingsStateSelected.checked && settingsDraftStateNames.length === 0) {
      throw new Error("Select at least one workflow state or choose All states.");
    }
    const member = settingsDiscovery?.member || {
      id: settings.memberId || memberIdFromProfile(elements.settingsProfileUrl.value),
      name: settings.memberName || ""
    };
    if (!member.id) throw new Error("Paste your My Work page address so Plane Pin can identify your account.");

    await window.planePin.saveSettings({
      ...connection,
      apiToken: elements.settingsToken.value,
      memberId: member.id,
      memberName: member.name,
      projectScope: elements.settingsProjectSingle.checked ? "single" : "all",
      projectId: elements.settingsProjectSingle.checked ? elements.settingsProjectId.value || settings.projectId : "",
      stateFilterMode: elements.settingsStateSelected.checked ? "selected" : "all",
      stateNames: elements.settingsStateSelected.checked ? settingsDraftStateNames : [],
      groupByProject: elements.settingsGroupProject.checked,
      alwaysOnTop: elements.settingsOnTop.checked,
      compactCards: elements.settingsCompactCards.checked,
      closeToTray: elements.settingsCloseTray.checked,
      minimizeToTray: elements.settingsMinimizeTray.checked,
      refreshMinutes: Number(elements.settingsRefreshMinutes.value),
      theme: elements.settingsThemeDark.checked ? "dark" : "light"
    });
    settings = await window.planePin.getSettings();
    applySettingsToShell();
    elements.settingsDialog.close();
    scheduleAutoRefresh();
    await refreshTasks();
  } catch (error) {
    elements.settingsError.textContent = error.message;
  } finally {
    elements.settingsSave.disabled = false;
    elements.settingsSave.textContent = "Save changes";
  }
}

function stateChip(task) {
  const chip = document.createElement("span");
  chip.className = "state-chip";
  const name = document.createElement("span");
  name.className = "state-name";
  name.textContent = task.stateName;
  chip.append(stateGlyph(task.stateGroup, task.stateColor), name);
  return chip;
}

function taskRow(task) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = `task-card priority-${task.priority}`;
  button.type = "button";
  const priority = task.priority && task.priority !== "none" ? ` · ${task.priority} priority` : "";
  button.setAttribute("aria-label", `Open ${task.identifier}: ${task.name} — ${task.stateName}${priority}`);
  button.title = `${task.identifier} · ${task.stateName}${priority}\n${task.name}`;
  button.addEventListener("click", async () => {
    try {
      await window.planePin.openTask(task.url);
    } catch (error) {
      elements.status.textContent = "Couldn’t open task";
      elements.count.textContent = error.message;
    }
  });

  const name = document.createElement("span");
  name.className = "task-name";
  name.textContent = task.name;
  const meta = document.createElement("span");
  meta.className = "task-meta";
  const identifier = document.createElement("span");
  identifier.className = "task-identifier";
  identifier.textContent = task.identifier;
  meta.append(identifier, stateChip(task));
  if (task.targetDate) {
    const due = document.createElement("span");
    due.className = "due-date";
    due.textContent = `Due ${task.targetDate}`;
    meta.append(due);
  }
  const openIcon = document.createElement("span");
  openIcon.className = "open-task-icon";
  openIcon.textContent = "↗";
  openIcon.setAttribute("aria-hidden", "true");
  button.append(name, meta, openIcon);
  item.append(button);
  return item;
}

function projectHeading(projectName, count) {
  const heading = document.createElement("li");
  heading.className = "project-heading";
  const name = document.createElement("span");
  name.textContent = projectName;
  const total = document.createElement("span");
  total.textContent = String(count);
  heading.append(name, total);
  return heading;
}

function filterTitle() {
  if (settings.stateFilterMode !== "selected" || settings.stateNames.length === 0) return "All assigned tasks";
  if (settings.stateNames.length === 1) return settings.stateNames[0];
  return "Selected states";
}

function renderTasks(tasks) {
  const rows = [];
  if (settings.groupByProject) {
    const projects = new Map();
    for (const task of tasks) {
      if (!projects.has(task.projectName)) projects.set(task.projectName, []);
      projects.get(task.projectName).push(task);
    }
    for (const [projectName, projectTasks] of projects) {
      rows.push(projectHeading(projectName, projectTasks.length), ...projectTasks.map(taskRow));
    }
  } else {
    rows.push(...tasks.map(taskRow));
  }
  elements.taskList.replaceChildren(...rows);
  elements.taskList.hidden = tasks.length === 0;
  elements.empty.hidden = tasks.length > 0;
  elements.listTitle.textContent = filterTitle();
  elements.empty.querySelector("h2").textContent = "No assigned tasks match.";
  elements.empty.querySelector("p").textContent = settings.stateFilterMode === "selected"
    ? "Try choosing more workflow states in Settings."
    : "Plane has no tasks assigned to this account yet.";
  $("#start-setup").textContent = settings.setupComplete ? "Open settings" : "Set up Plane Pin";
  elements.count.textContent = `${tasks.length} assigned ${tasks.length === 1 ? "task" : "tasks"}`;
  elements.status.textContent = settings.memberName ? `Connected as ${settings.memberName}` : "Connected";
}

async function refreshTasks() {
  if (refreshing || !settings.tokenSet) return;
  refreshing = true;
  elements.refresh.disabled = true;
  elements.refresh.classList.add("is-refreshing");
  elements.status.textContent = "Refreshing…";
  try {
    renderTasks(await window.planePin.listTasks());
  } catch (error) {
    elements.status.textContent = "Needs attention";
    elements.count.textContent = error.message;
    elements.taskList.hidden = true;
    elements.empty.hidden = false;
    elements.empty.querySelector("h2").textContent = "Couldn’t load Plane.";
    elements.empty.querySelector("p").textContent = settings.tokenError
      ? "Open Settings and replace the saved personal access token."
      : error.message;
    $("#start-setup").textContent = "Open settings";
  } finally {
    refreshing = false;
    elements.refresh.disabled = false;
    elements.refresh.classList.remove("is-refreshing");
  }
}

function scheduleAutoRefresh() {
  clearInterval(refreshTimer);
  if (settings.tokenSet && settings.refreshMinutes > 0) {
    refreshTimer = setInterval(refreshTasks, settings.refreshMinutes * 60_000);
  }
}

function applySettingsToShell() {
  isMac = settings.platform === "darwin";
  document.body.classList.toggle("platform-mac", isMac);
  localiseShortcutLabels();
  applyTheme(settings.theme);
  setPinVisual(settings.alwaysOnTop);
  applyCompactCards(settings.compactCards);
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  elements.settingsCloseTray.checked = settings.closeToTray;
  elements.settingsMinimizeTray.checked = settings.minimizeToTray;
  elements.listTitle.textContent = filterTitle();
  elements.refresh.disabled = !settings.tokenSet;
  for (const slot of document.querySelectorAll(".tray-location")) {
    slot.textContent = settings.trayLocation || "system tray";
  }
}

function togglePassword(input, button) {
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.textContent = visible ? "Hide" : "Show";
  button.setAttribute("aria-pressed", String(visible));
}

elements.pinToggle.addEventListener("click", togglePin);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.compactToggle.addEventListener("click", () => setCompactMode(!compactMode));
elements.refresh.addEventListener("click", refreshTasks);
elements.settingsOpen.addEventListener("click", openSettings);
$("#start-setup").addEventListener("click", () => settings.setupComplete ? openSettings() : openOnboarding());
$("#window-minimize").addEventListener("click", window.planePin.minimizeWindow);
$("#window-maximize").addEventListener("click", window.planePin.toggleMaximizeWindow);
$("#window-close").addEventListener("click", window.planePin.closeWindow);

elements.setupClose.addEventListener("click", () => elements.setup.close());
elements.setupLater.addEventListener("click", () => elements.setup.close());
elements.setupBack.addEventListener("click", () => showStep(Math.max(0, setupStep - 1)));
elements.projectAll.addEventListener("change", updateOnboardingProjectChoice);
elements.projectSingle.addEventListener("change", updateOnboardingProjectChoice);
elements.projectId.addEventListener("change", renderOnboardingStates);
elements.stateAll.addEventListener("change", renderOnboardingStates);
elements.stateSelected.addEventListener("change", renderOnboardingStates);
elements.tokenVisibility.addEventListener("click", () => togglePassword(elements.apiToken, elements.tokenVisibility));
elements.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.setupError.textContent = "";
  await advanceSetup();
});

elements.settingsClose.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsCancel.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsTokenVisibility.addEventListener("click", () =>
  togglePassword(elements.settingsToken, elements.settingsTokenVisibility));
elements.settingsTest.addEventListener("click", async () => {
  try {
    await testSettingsConnection();
  } catch {
    // Error is already visible beside the action.
  }
});
elements.settingsProjectAll.addEventListener("change", updateSettingsProjectChoice);
elements.settingsProjectSingle.addEventListener("change", updateSettingsProjectChoice);
elements.settingsProjectId.addEventListener("change", renderSettingsStates);
elements.settingsStateAll.addEventListener("change", renderSettingsStates);
elements.settingsStateSelected.addEventListener("change", renderSettingsStates);
elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettingsForm();
});

document.addEventListener("mousedown", beginWindowDrag);
document.addEventListener("mousemove", continueWindowDrag);
document.addEventListener("mouseup", finishWindowDrag);
window.addEventListener("blur", () => {
  windowDrag.cancel();
  window.planePin.endWindowDrag();
  if (dragFrame) cancelAnimationFrame(dragFrame);
  dragFrame = 0;
  pendingDrag = null;
  document.body.classList.remove("is-dragging-window");
});
// A gesture that moved the window must not also activate what it started on.
document.addEventListener("click", (event) => {
  if (!suppressNextClick) return;
  suppressNextClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);

window.planePin.onTrayCommand(async (command) => {
  if (command === "refresh") return refreshTasks();
  if (command === "settings") return openSettings();
  settings = await window.planePin.getSettings();
  if (command === "compact-cards") return applyCompactCards(settings.compactCards);
  if (command === "always-on-top") {
    setPinVisual(settings.alwaysOnTop);
    elements.preferOnTop.checked = settings.alwaysOnTop;
    elements.settingsOnTop.checked = settings.alwaysOnTop;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && compactMode && !elements.setup.open && !elements.settingsDialog.open) {
    event.preventDefault();
    setCompactMode(false);
    return;
  }
  if (!modifierHeld(event) || !event.shiftKey) {
    if (modifierHeld(event) && event.key === ",") {
      event.preventDefault();
      openSettings();
    }
    return;
  }
  const key = event.key.toLocaleLowerCase();
  if (key === "t") {
    event.preventDefault();
    togglePin();
  } else if (key === "h") {
    event.preventDefault();
    setCompactMode(!compactMode);
  } else if (key === "d") {
    event.preventDefault();
    toggleTheme();
  } else if (key === "r" && !refreshing) {
    event.preventDefault();
    refreshTasks();
  }
});

async function init() {
  settings = await window.planePin.getSettings();
  applySettingsToShell();
  scheduleAutoRefresh();
  if (!settings.setupComplete) {
    elements.status.textContent = "Setup not finished";
    requestAnimationFrame(openOnboarding);
    return;
  }
  if (settings.tokenSet) {
    await refreshTasks();
    return;
  }
  elements.status.textContent = "Reconnect in Settings";
  elements.count.textContent = "Your saved preferences are intact.";
  elements.empty.querySelector("h2").textContent = "Plane needs a new token.";
  elements.empty.querySelector("p").textContent = "Open Settings and replace the personal access token. Onboarding will not run again.";
  $("#start-setup").textContent = "Open settings";
}

init();
