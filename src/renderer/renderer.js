"use strict";

const $ = (selector) => document.querySelector(selector);
const { layoutTasks, orderItems: orderedItems } = window.planePinTaskLayout;
const elements = {
  updateToolbar: $("#update-toolbar"),
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
  memberOptions: $("#member-options"),
  memberSelectAll: $("#member-select-all"),
  memberSelectNone: $("#member-select-none"),
  projectOptions: $("#project-options"),
  projectSelectAll: $("#project-select-all"),
  projectSelectNone: $("#project-select-none"),
  stateOptions: $("#state-options"),
  stateSelectAll: $("#state-select-all"),
  stateSelectNone: $("#state-select-none"),
  groupByProject: $("#group-by-project"),
  preferOnTop: $("#prefer-on-top"),
  settingsDialog: $("#settings-dialog"),
  settingsBody: $(".settings-body"),
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
  settingsMemberOptions: $("#settings-member-options"),
  settingsMemberSelectAll: $("#settings-member-select-all"),
  settingsMemberSelectNone: $("#settings-member-select-none"),
  settingsProjectOptions: $("#settings-project-options"),
  settingsProjectSelectAll: $("#settings-project-select-all"),
  settingsProjectSelectNone: $("#settings-project-select-none"),
  settingsStateOptions: $("#settings-state-options"),
  settingsStateSelectAll: $("#settings-state-select-all"),
  settingsStateSelectNone: $("#settings-state-select-none"),
  settingsChangeOnCheck: $("#settings-change-on-check"),
  settingsCheckOptions: $("#settings-check-options"),
  settingsCheckTargetState: $("#settings-check-target-state"),
  settingsCompletionSound: $("#settings-completion-sound"),
  settingsGroupProject: $("#settings-group-project"),
  settingsGroupMember: $("#settings-group-member"),
  settingsOnTop: $("#settings-on-top"),
  settingsCompactCards: $("#settings-compact-cards"),
  settingsPriorityDot: $("#settings-priority-dot"),
  settingsPriorityGradient: $("#settings-priority-gradient"),
  settingsStartAtLogin: $("#settings-start-at-login"),
  settingsStartAtLoginNote: $("#settings-start-at-login-note"),
  updateStatusTitle: $("#update-status-title"),
  updateStatusMessage: $("#update-status-message"),
  updateAction: $("#update-action"),
  updateProgress: $("#update-progress"),
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
  "Choose whose tasks appear",
  "Choose your projects",
  "Filter by workflow state",
  "Your viewing preferences"
];
const stepActions = ["Get started", "Continue", "Test connection", "Continue", "Continue", "Continue", "Save and show my tasks"];
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
let draftAssigneeIds;
let draftProjectIds;
let draftStateNames;
let settingsDraftAssigneeIds;
let settingsDraftProjectIds;
let settingsDraftStateNames;
let settingsDraftMemberOrder;
let settingsDraftProjectOrder;
let settingsDraftStateOrder;
let settingsScrollTop = 0;
const windowDrag = window.planePinDrag.createDragTracker();
let suppressNextClick = false;
let dragFrame = 0;
let pendingDrag = null;
let isMac = false;
let updateState = { status: "idle", currentVersion: "", availableVersion: "", progress: 0 };

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
  if (!workspaceSlug) throw new Error("Paste your Plane workspace home address, including the workspace name.");
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

function selectedOrAll(selected, values) {
  return selected === null ? [...values] : [...(selected || [])];
}

function resolvedProjectIds(projects, selected) {
  if (selected === null) return projects.map((project) => project.id);
  const keys = new Set((selected || []).map((value) => String(value).toLocaleLowerCase()));
  return projects
    .filter((project) =>
      keys.has(project.id.toLocaleLowerCase())
      || keys.has(project.identifier.toLocaleLowerCase()))
    .map((project) => project.id);
}

function syncSelectionActions(container, selectAll, selectNone) {
  const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
  const selectedCount = inputs.filter((input) => input.checked).length;
  selectAll.disabled = inputs.length === 0 || selectedCount === inputs.length;
  selectNone.disabled = selectedCount === 0;
}

function setEverySelection(container, checked, onChange) {
  for (const input of container.querySelectorAll('input[type="checkbox"]')) input.checked = checked;
  onChange();
}

function addReorderHandle(row, value, orderedValues, onReorder) {
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.draggable = true;
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Drag to reorder");
  handle.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
  handle.innerHTML = "<i></i><i></i><i></i>";

  const move = (direction) => {
    const from = orderedValues.indexOf(value);
    const to = Math.max(0, Math.min(orderedValues.length - 1, from + direction));
    if (from === to) return;
    const next = [...orderedValues];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };
  handle.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    move(event.key === "ArrowUp" ? -1 : 1);
  });
  handle.addEventListener("click", (event) => event.preventDefault());
  handle.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", value);
    row.classList.add("is-dragging");
  });
  handle.addEventListener("dragend", () => row.classList.remove("is-dragging"));
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain");
    const from = orderedValues.indexOf(dragged);
    const to = orderedValues.indexOf(value);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...orderedValues];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  });
  row.append(handle);
}

function availableStates(source, projectIds) {
  if (!source) return [];
  const selectedKeys = Array.isArray(projectIds)
    ? new Set(projectIds.map((value) => String(value).toLocaleLowerCase()))
    : null;
  const selectedProjects = projectIds === null
    ? source.projects
    : source.projects.filter((project) =>
      selectedKeys.has(project.id.toLocaleLowerCase())
      || selectedKeys.has(project.identifier.toLocaleLowerCase()));
  const states = new Map();
  for (const project of selectedProjects) {
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

function renderStateRows(container, states, selectedNames, onChange, reorder = null) {
  const visibleStates = reorder ? orderedItems(states, reorder.order, (state) => state.name) : states;
  const resolvedNames = selectedOrAll(selectedNames, states.map((state) => state.name));
  const selected = new Set(resolvedNames.map((name) => name.toLocaleLowerCase()));
  const orderedValues = visibleStates.map((state) => state.name);
  const rows = visibleStates.map((state) => {
    const label = document.createElement("label");
    label.className = "selection-row state-row";
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
    if (reorder) addReorderHandle(label, state.name, orderedValues, reorder.onChange);
    return label;
  });
  container.replaceChildren(...rows);
}

function renderSelectionRows(container, items, selectedIds, secondaryText, onChange, reorder = null) {
  const visibleItems = reorder ? orderedItems(items, reorder.order, (item) => item.id) : items;
  const selected = new Set(selectedOrAll(selectedIds, items.map((item) => item.id)));
  const orderedValues = visibleItems.map((item) => item.id);
  const rows = visibleItems.map((item) => {
    const label = document.createElement("label");
    label.className = "selection-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = item.id;
    input.checked = selected.has(item.id);
    input.addEventListener("change", onChange);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const secondary = document.createElement("small");
    secondary.textContent = secondaryText(item);
    copy.append(name, secondary);
    label.append(input, copy);
    if (reorder) addReorderHandle(label, item.id, orderedValues, reorder.onChange);
    return label;
  });
  container.replaceChildren(...rows);
}

function renderOnboardingMembers() {
  const members = discovery?.members || [];
  draftAssigneeIds = selectedOrAll(draftAssigneeIds, members.map((member) => member.id));
  const update = () => {
    draftAssigneeIds = selectedValues(elements.memberOptions);
    syncSelectionActions(elements.memberOptions, elements.memberSelectAll, elements.memberSelectNone);
  };
  renderSelectionRows(
    elements.memberOptions,
    members,
    draftAssigneeIds,
    (member) => member.email || "Workspace member",
    update
  );
  update();
}

function renderOnboardingProjects() {
  const projects = discovery?.projects || [];
  draftProjectIds = resolvedProjectIds(projects, draftProjectIds);
  const update = () => {
    draftProjectIds = selectedValues(elements.projectOptions);
    syncSelectionActions(elements.projectOptions, elements.projectSelectAll, elements.projectSelectNone);
  };
  renderSelectionRows(
    elements.projectOptions,
    projects,
    draftProjectIds,
    (project) => project.identifier || "Plane project",
    update
  );
  update();
}

function renderOnboardingStates() {
  const states = availableStates(discovery, draftProjectIds);
  draftStateNames = selectedOrAll(draftStateNames, states.map((state) => state.name));
  const update = () => {
    draftStateNames = selectedValues(elements.stateOptions);
    syncSelectionActions(elements.stateOptions, elements.stateSelectAll, elements.stateSelectNone);
  };
  renderStateRows(elements.stateOptions, states, draftStateNames, update);
  syncSelectionActions(elements.stateOptions, elements.stateSelectAll, elements.stateSelectNone);
}

function showStep(nextStep) {
  setupStep = nextStep;
  for (const panel of document.querySelectorAll(".setup-step")) {
    const active = Number(panel.dataset.step) === setupStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  elements.setupTitle.textContent = stepTitles[setupStep];
  elements.setupProgress.textContent = setupStep === 0 ? "Welcome" : `Step ${setupStep} of 6`;
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
  draftAssigneeIds = settings.setupComplete ? [...(settings.assigneeIds || [])] : null;
  draftProjectIds = settings.setupComplete && Array.isArray(settings.projectIds) ? [...settings.projectIds] : null;
  draftStateNames = settings.setupComplete && Array.isArray(settings.stateNames) ? [...settings.stateNames] : null;
  connectionDraft = { baseUrl: settings.baseUrl || "", workspaceSlug: settings.workspaceSlug || "" };
  elements.planePageUrl.value = settings.baseUrl && settings.workspaceSlug
    ? `${settings.baseUrl}/${settings.workspaceSlug}/`
    : "";
  elements.apiToken.value = "";
  elements.apiToken.type = "password";
  elements.tokenVisibility.textContent = "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", "false");
  elements.profileUrl.value = settings.memberId ? `/profile/${settings.memberId}/assigned/` : "";
  elements.groupByProject.checked = settings.groupByProject;
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.memberFallback.hidden = true;
  elements.memberOptions.replaceChildren();
  elements.projectOptions.replaceChildren();
  elements.stateOptions.replaceChildren();
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
      const member = discovery.member || (settings.memberId ? {
        id: settings.memberId,
        name: settings.memberName || "your saved Plane account"
      } : null);
      elements.memberSummary.textContent = member
        ? `Connected as ${member.name}. Choose from ${discovery.members.length} ${discovery.members.length === 1 ? "member" : "members"}.`
        : `Connection works. Choose workspace members below, then paste your My Work link so Plane Pin can identify the saved account.`;
      elements.memberFallback.hidden = Boolean(member);
      renderOnboardingMembers();
      renderOnboardingProjects();
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
    if (!discovery.member?.id && !settings.memberId && !memberIdFromProfile(elements.profileUrl.value)) {
      elements.setupError.textContent = "Paste your My Work page address so Plane Pin can identify your account.";
      return;
    }
    showStep(4);
    return;
  }
  if (setupStep === 4) {
    renderOnboardingStates();
    showStep(5);
    return;
  }
  if (setupStep === 5) return showStep(6);

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
      assigneeIds: draftAssigneeIds,
      projectIds: draftProjectIds,
      stateNames: draftStateNames,
      memberOrder: discovery.members.map((item) => item.id),
      projectOrder: discovery.projects.map((item) => item.id),
      stateOrder: availableStates(discovery, draftProjectIds).map((item) => item.name),
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
    elements.setupNext.textContent = stepActions[6];
  }
}

function renderSettingsMembers() {
  const members = settingsDiscovery?.members || [];
  settingsDraftAssigneeIds = selectedOrAll(settingsDraftAssigneeIds, members.map((member) => member.id));
  settingsDraftMemberOrder = orderedItems(members, settingsDraftMemberOrder, (member) => member.id).map((member) => member.id);
  const update = () => {
    settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
    syncSelectionActions(elements.settingsMemberOptions, elements.settingsMemberSelectAll, elements.settingsMemberSelectNone);
  };
  renderSelectionRows(
    elements.settingsMemberOptions,
    members,
    settingsDraftAssigneeIds,
    (member) => member.email || "Workspace member",
    update,
    {
      order: settingsDraftMemberOrder,
      onChange: (next) => {
        settingsDraftMemberOrder = next;
        renderSettingsMembers();
      }
    }
  );
  update();
}

function renderSettingsProjects() {
  const projects = settingsDiscovery?.projects || [];
  settingsDraftProjectIds = resolvedProjectIds(projects, settingsDraftProjectIds);
  settingsDraftProjectOrder = orderedItems(projects, settingsDraftProjectOrder, (project) => project.id).map((project) => project.id);
  const update = () => {
    settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
    syncSelectionActions(elements.settingsProjectOptions, elements.settingsProjectSelectAll, elements.settingsProjectSelectNone);
    renderSettingsStates();
  };
  renderSelectionRows(
    elements.settingsProjectOptions,
    projects,
    settingsDraftProjectIds,
    (project) => project.identifier || "Plane project",
    update,
    {
      order: settingsDraftProjectOrder,
      onChange: (next) => {
        settingsDraftProjectOrder = next;
        renderSettingsProjects();
      }
    }
  );
  syncSelectionActions(elements.settingsProjectOptions, elements.settingsProjectSelectAll, elements.settingsProjectSelectNone);
}

function renderSettingsStates() {
  const states = settingsDiscovery ? availableStates(settingsDiscovery, settingsDraftProjectIds) : [];
  settingsDraftStateNames = selectedOrAll(settingsDraftStateNames, states.map((state) => state.name));
  settingsDraftStateOrder = orderedItems(states, settingsDraftStateOrder, (state) => state.name).map((state) => state.name);
  const update = () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    syncSelectionActions(elements.settingsStateOptions, elements.settingsStateSelectAll, elements.settingsStateSelectNone);
  };
  renderStateRows(elements.settingsStateOptions, states, settingsDraftStateNames, update, {
    order: settingsDraftStateOrder,
    onChange: (next) => {
      settingsDraftStateOrder = next;
      renderSettingsStates();
    }
  });
  syncSelectionActions(elements.settingsStateOptions, elements.settingsStateSelectAll, elements.settingsStateSelectNone);
  renderSettingsCompletionOptions(states);
}

function renderSettingsCompletionOptions(states) {
  const current = elements.settingsCheckTargetState.value || settings.checkTargetStateName;
  const ordered = orderedItems(states, settingsDraftStateOrder, (state) => state.name);
  elements.settingsCheckTargetState.replaceChildren(...ordered.map((state) => {
    const option = document.createElement("option");
    option.value = state.name;
    option.textContent = `${state.name} · ${stateGroupLabels[state.group] || "Workflow state"}`;
    return option;
  }));
  const fallback = ordered.find((state) => state.group === "completed")?.name || ordered[0]?.name || "";
  elements.settingsCheckTargetState.value = ordered.some((state) => state.name === current) ? current : fallback;
  elements.settingsCheckOptions.hidden = !elements.settingsChangeOnCheck.checked;
}

function applySettingsDiscovery(result) {
  settingsDiscovery = result;
  const member = settingsDiscovery.member || (settings.memberId ? {
    id: settings.memberId,
    name: settings.memberName || "saved Plane account"
  } : null);
  elements.settingsConnectionStatus.textContent = member
    ? `Connected as ${member.name} · ${result.members.length} members · ${result.projects.length} projects`
    : `Connected · ${result.members.length} members · ${result.projects.length} projects · My Work link required`;
  elements.settingsConnectionStatus.className = "connection-ok";
  elements.settingsProfileField.hidden = Boolean(member);
  renderSettingsMembers();
  renderSettingsProjects();
  renderSettingsStates();
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
  settingsDraftAssigneeIds = [...(settings.assigneeIds || [])];
  settingsDraftProjectIds = Array.isArray(settings.projectIds) ? [...settings.projectIds] : null;
  settingsDraftStateNames = Array.isArray(settings.stateNames) ? [...settings.stateNames] : null;
  settingsDraftMemberOrder = [...(settings.memberOrder || [])];
  settingsDraftProjectOrder = [...(settings.projectOrder || [])];
  settingsDraftStateOrder = [...(settings.stateOrder || [])];
  elements.settingsPlaneUrl.value = settings.baseUrl && settings.workspaceSlug
    ? `${settings.baseUrl}/${settings.workspaceSlug}/`
    : "";
  elements.settingsToken.value = "";
  elements.settingsToken.type = "password";
  elements.settingsTokenVisibility.textContent = "Show";
  elements.settingsTokenVisibility.setAttribute("aria-pressed", "false");
  elements.settingsToken.placeholder = settings.tokenSet ? "Saved securely — enter only to replace" : "Enter a Plane API token";
  elements.settingsTokenNote.textContent = settings.tokenUnavailable
    ? "The saved token is still encrypted on disk. Unlock your system keyring, then refresh or restart Plane Pin."
    : settings.tokenError
      ? "Your operating system could not unlock the saved token. Enter it again, then save."
    : "Leave blank to keep the encrypted token already saved.";
  elements.settingsProfileUrl.value = settings.memberId ? `/profile/${settings.memberId}/assigned/` : "";
  elements.settingsProfileField.hidden = Boolean(settings.memberId);
  elements.settingsGroupProject.checked = settings.groupByProject;
  elements.settingsGroupMember.checked = settings.groupByMember;
  elements.settingsChangeOnCheck.checked = settings.changeOnCheck;
  elements.settingsCheckOptions.hidden = !settings.changeOnCheck;
  elements.settingsCheckTargetState.replaceChildren();
  elements.settingsCompletionSound.checked = settings.completionSound;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  elements.settingsCompactCards.checked = settings.compactCards;
  elements.settingsPriorityDot.checked = settings.priorityStyle !== "gradient";
  elements.settingsPriorityGradient.checked = settings.priorityStyle === "gradient";
  elements.settingsStartAtLogin.checked = settings.startAtLogin;
  elements.settingsStartAtLoginNote.textContent = settings.loginStartupStatus === "requires-approval"
    ? "Allow Plane Pin in System Settings → General → Login Items."
    : `Launch Plane Pin quietly in the ${settings.trayLocation || "system tray"}.`;
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
  for (const container of [
    elements.settingsMemberOptions,
    elements.settingsProjectOptions,
    elements.settingsStateOptions
  ]) container.replaceChildren();
  for (const button of [
    elements.settingsMemberSelectAll,
    elements.settingsMemberSelectNone,
    elements.settingsProjectSelectAll,
    elements.settingsProjectSelectNone,
    elements.settingsStateSelectAll,
    elements.settingsStateSelectNone
  ]) button.disabled = true;
}

async function openSettings() {
  hydrateSettingsForm();
  refreshUpdateState();
  elements.settingsError.textContent = "";
  if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
  requestAnimationFrame(() => {
    elements.settingsPlaneUrl.focus({ preventScroll: true });
    elements.settingsBody.scrollTop = settingsScrollTop;
  });
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
    if (settingsDiscovery) {
      settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
      settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
      settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
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
      assigneeIds: settingsDraftAssigneeIds,
      projectIds: settingsDraftProjectIds,
      stateNames: settingsDraftStateNames,
      memberOrder: settingsDraftMemberOrder,
      projectOrder: settingsDraftProjectOrder,
      stateOrder: settingsDraftStateOrder,
      groupByProject: elements.settingsGroupProject.checked,
      groupByMember: elements.settingsGroupMember.checked,
      changeOnCheck: elements.settingsChangeOnCheck.checked,
      checkTargetStateName: elements.settingsCheckTargetState.value,
      completionSound: elements.settingsCompletionSound.checked,
      alwaysOnTop: elements.settingsOnTop.checked,
      compactCards: elements.settingsCompactCards.checked,
      priorityStyle: elements.settingsPriorityGradient.checked ? "gradient" : "dot",
      startAtLogin: elements.settingsStartAtLogin.checked,
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

function estimateChip(task) {
  const chip = document.createElement("span");
  chip.className = "estimate-chip";
  chip.textContent = task.estimate;
  chip.title = `Estimate: ${task.estimate}`;
  chip.setAttribute("aria-label", `Estimate ${task.estimate}`);
  return chip;
}

function celebrateTask(item) {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const burst = document.createElement("span");
    burst.className = "confetti-burst";
    for (let index = 0; index < 10; index += 1) {
      const piece = document.createElement("i");
      piece.style.setProperty("--angle", `${index * 36}deg`);
      piece.style.setProperty("--hue", `${index * 37}deg`);
      burst.append(piece);
    }
    item.append(burst);
    setTimeout(() => burst.remove(), 900);
  }
  if (!settings.completionSound) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  const context = new Audio();
  const now = context.currentTime;
  for (const [frequency, delay] of [[520, 0], [760, 0.055], [980, 0.11]]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "triangle";
    gain.gain.setValueAtTime(0.08, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + 0.13);
  }
  setTimeout(() => context.close(), 500);
}

function taskRow(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  const button = document.createElement("button");
  button.className = `task-card priority-${task.priority}`;
  button.type = "button";
  const priority = task.priority && task.priority !== "none" ? ` · ${task.priority} priority` : "";
  const estimate = task.estimate ? ` · estimate ${task.estimate}` : "";
  button.setAttribute("aria-label", `Open ${task.identifier}: ${task.name} — ${task.stateName}${priority}${estimate}`);
  button.title = `${task.identifier} · ${task.stateName}${priority}${estimate}\n${task.name}`;
  button.addEventListener("click", async () => {
    try {
      await window.planePin.openTask(task.url);
    } catch (error) {
      elements.status.textContent = "Couldn’t open task";
      elements.count.textContent = error.message;
    }
  });

  const priorityDot = document.createElement("span");
  priorityDot.className = "priority-dot";
  priorityDot.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "task-name";
  name.textContent = task.name;
  const meta = document.createElement("span");
  meta.className = "task-meta";
  const identifier = document.createElement("span");
  identifier.className = "task-identifier";
  identifier.textContent = task.identifier;
  meta.append(identifier, stateChip(task));
  if (task.estimate) meta.append(estimateChip(task));
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
  button.append(priorityDot, name, meta, openIcon);
  item.append(button);
  if (settings.changeOnCheck) {
    const complete = document.createElement("button");
    complete.className = "complete-task";
    complete.type = "button";
    complete.setAttribute("aria-label", `Move ${task.identifier} to ${settings.checkTargetStateName}`);
    complete.dataset.tooltip = `Move to ${settings.checkTargetStateName}`;
    complete.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.2 8.2 3 3 6.6-6.5"></path></svg>';
    complete.addEventListener("click", async (event) => {
      event.stopPropagation();
      complete.disabled = true;
      item.classList.add("is-checking");
      try {
        await window.planePin.changeTaskState(task.id, task.projectId);
        item.classList.remove("is-checking");
        item.classList.add("is-checked");
        celebrateTask(item);
        setTimeout(refreshTasks, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 700);
      } catch (error) {
        item.classList.remove("is-checking");
        complete.disabled = false;
        elements.status.textContent = "Couldn’t change task";
        elements.count.textContent = error.message;
      }
    });
    item.append(complete);
  }
  return item;
}

function groupHeading(type, nameText, count, nested = false) {
  const heading = document.createElement("li");
  heading.className = `${type}-heading${nested ? " is-nested" : ""}`;
  const name = document.createElement("span");
  name.textContent = nameText;
  const total = document.createElement("span");
  total.textContent = String(count);
  heading.append(name, total);
  return heading;
}

function filterTitle() {
  if (settings.stateNames === null) return "All selected tasks";
  if (settings.stateNames.length === 0) return "No workflow states";
  if (settings.stateNames.length === 1) return settings.stateNames[0];
  return `${settings.stateNames.length} workflow states`;
}

function renderTasks(tasks) {
  const rows = layoutTasks(tasks, settings).map((row) => {
    if (row.type === "task") return taskRow(row.task);
    return groupHeading(row.type, row.name, row.count, row.nested);
  });
  elements.taskList.replaceChildren(...rows);
  elements.taskList.hidden = tasks.length === 0;
  elements.empty.hidden = tasks.length > 0;
  elements.listTitle.textContent = filterTitle();
  elements.empty.querySelector("h2").textContent = "No tasks match.";
  elements.empty.querySelector("p").textContent = "Choose more members, projects, or workflow states in Settings.";
  $("#start-setup").textContent = settings.setupComplete ? "Open settings" : "Set up Plane Pin";
  elements.count.textContent = `${tasks.length} selected ${tasks.length === 1 ? "task" : "tasks"}`;
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
  document.body.classList.toggle("priority-gradient", settings.priorityStyle === "gradient");
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  elements.settingsStartAtLogin.checked = settings.startAtLogin;
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

function renderUpdateState(next = {}) {
  updateState = { ...updateState, ...next };
  const version = updateState.availableVersion ? `v${updateState.availableVersion}` : "the update";
  const current = updateState.currentVersion || settings?.appVersion || "";
  const view = {
    idle: [`Plane Pin v${current}`, "Checks automatically when Plane Pin starts.", "Check for updates", false],
    unavailable: ["Automatic updates unavailable", updateState.message || "This build cannot install updates automatically.", "Unavailable", true],
    checking: ["Checking for updates…", "Looking at the latest Plane Pin release.", "Checking…", true],
    "up-to-date": ["Plane Pin is up to date", `You’re running v${current}.`, "Check again", false],
    available: [`Plane Pin ${version} is available`, "Download, install, and restart automatically.", `Update to ${version}`, false],
    downloading: [`Downloading ${version}…`, `${Math.round(updateState.progress || 0)}% complete.`, `Downloading ${Math.round(updateState.progress || 0)}%`, true],
    ready: ["Update ready", `Restart to finish installing ${version}.`, "Restart and update", false],
    installing: ["Installing update…", "Plane Pin will reopen automatically.", "Restarting…", true],
    error: ["Couldn’t check for updates", updateState.error || "Try again in a moment.", "Try again", false]
  }[updateState.status] || ["Ready to check", "", "Check for updates", false];
  [elements.updateStatusTitle.textContent, elements.updateStatusMessage.textContent, elements.updateAction.textContent, elements.updateAction.disabled] = view;
  elements.updateProgress.hidden = updateState.status !== "downloading";
  elements.updateProgress.value = updateState.progress || 0;
  const showToolbarUpdate = ["available", "downloading", "ready", "installing"].includes(updateState.status);
  elements.updateToolbar.hidden = !showToolbarUpdate;
  elements.updateToolbar.disabled = ["downloading", "installing"].includes(updateState.status);
  elements.updateToolbar.classList.toggle("is-glowing", ["available", "ready"].includes(updateState.status));
  elements.updateToolbar.dataset.tooltip = updateState.status === "ready"
    ? `Restart and install ${version}`
    : updateState.status === "downloading"
      ? `Downloading ${version} · ${Math.round(updateState.progress || 0)}%`
      : `Install ${version}`;
  elements.updateToolbar.setAttribute("aria-label", elements.updateToolbar.dataset.tooltip);
}

async function refreshUpdateState() {
  try {
    renderUpdateState(await window.planePin.getUpdateState());
  } catch (error) {
    renderUpdateState({ status: "error", error: error.message });
  }
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
elements.memberSelectAll.addEventListener("click", () => setEverySelection(elements.memberOptions, true, () => {
  draftAssigneeIds = selectedValues(elements.memberOptions);
  syncSelectionActions(elements.memberOptions, elements.memberSelectAll, elements.memberSelectNone);
}));
elements.memberSelectNone.addEventListener("click", () => setEverySelection(elements.memberOptions, false, () => {
  draftAssigneeIds = selectedValues(elements.memberOptions);
  syncSelectionActions(elements.memberOptions, elements.memberSelectAll, elements.memberSelectNone);
}));
elements.projectSelectAll.addEventListener("click", () => setEverySelection(elements.projectOptions, true, () => {
  draftProjectIds = selectedValues(elements.projectOptions);
  syncSelectionActions(elements.projectOptions, elements.projectSelectAll, elements.projectSelectNone);
}));
elements.projectSelectNone.addEventListener("click", () => setEverySelection(elements.projectOptions, false, () => {
  draftProjectIds = selectedValues(elements.projectOptions);
  syncSelectionActions(elements.projectOptions, elements.projectSelectAll, elements.projectSelectNone);
}));
elements.stateSelectAll.addEventListener("click", () => setEverySelection(elements.stateOptions, true, () => {
  draftStateNames = selectedValues(elements.stateOptions);
  syncSelectionActions(elements.stateOptions, elements.stateSelectAll, elements.stateSelectNone);
}));
elements.stateSelectNone.addEventListener("click", () => setEverySelection(elements.stateOptions, false, () => {
  draftStateNames = selectedValues(elements.stateOptions);
  syncSelectionActions(elements.stateOptions, elements.stateSelectAll, elements.stateSelectNone);
}));
elements.tokenVisibility.addEventListener("click", () => togglePassword(elements.apiToken, elements.tokenVisibility));
elements.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.setupError.textContent = "";
  await advanceSetup();
});

elements.settingsClose.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsCancel.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsBody.addEventListener("scroll", () => {
  settingsScrollTop = elements.settingsBody.scrollTop;
});
elements.settingsTokenVisibility.addEventListener("click", () =>
  togglePassword(elements.settingsToken, elements.settingsTokenVisibility));
elements.settingsChangeOnCheck.addEventListener("change", () => {
  elements.settingsCheckOptions.hidden = !elements.settingsChangeOnCheck.checked;
});
async function runUpdateAction(forceInstall = false) {
  try {
    renderUpdateState(forceInstall || updateState.status === "available" || updateState.status === "ready"
      ? await window.planePin.installUpdate()
      : await window.planePin.checkForUpdates());
  } catch (error) {
    renderUpdateState({ status: "error", error: error.message });
  }
}
elements.updateAction.addEventListener("click", () => runUpdateAction());
elements.updateToolbar.addEventListener("click", () => runUpdateAction(true));
elements.settingsTest.addEventListener("click", async () => {
  try {
    await testSettingsConnection();
  } catch {
    // Error is already visible beside the action.
  }
});
elements.settingsMemberSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsMemberOptions, true, () => {
    settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
    renderSettingsMembers();
  }));
elements.settingsMemberSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsMemberOptions, false, () => {
    settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
    renderSettingsMembers();
  }));
elements.settingsProjectSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsProjectOptions, true, () => {
    settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
    renderSettingsProjects();
    renderSettingsStates();
  }));
elements.settingsProjectSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsProjectOptions, false, () => {
    settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
    renderSettingsProjects();
    renderSettingsStates();
  }));
elements.settingsStateSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsStateOptions, true, () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    renderSettingsStates();
  }));
elements.settingsStateSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsStateOptions, false, () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    renderSettingsStates();
  }));
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
window.planePin.onUpdateState(renderUpdateState);

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
  if (settings.tokenUnavailable) {
    elements.status.textContent = "System keyring locked";
    elements.count.textContent = "Your saved token is still encrypted on disk.";
    elements.empty.querySelector("h2").textContent = "Unlock your system keyring.";
    elements.empty.querySelector("p").textContent = "Then press Refresh. You do not need to enter the token again.";
    $("#start-setup").textContent = "Open settings";
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
