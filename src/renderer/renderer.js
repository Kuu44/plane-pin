"use strict";

const $ = (selector) => document.querySelector(selector);
const {
  dropOrderedValue,
  filterTasks,
  layoutTasks,
  moveOrderedValue,
  orderItems: orderedItems
} = window.planePinTaskLayout;
const {
  defaultStateMappings,
  shouldCelebrateTransition,
  targetForState
} = window.planePinCompletion;
const settingsView = new URLSearchParams(location.search).get("view") === "settings";
document.body.dataset.view = settingsView ? "settings" : "tasks";
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
  undoToasts: $("#undo-toasts"),
  appTooltip: $("#app-tooltip"),
  setup: $("#setup"),
  setupForm: $("#setup-form"),
  setupTitle: $("#setup-title"),
  setupProgress: $("#setup-progress"),
  setupClose: $("#setup-close"),
  setupLater: $("#setup-later"),
  setupBack: $("#setup-back"),
  setupNext: $("#setup-next"),
  setupError: $("#setup-error"),
  setupStartAtLogin: $("#setup-start-at-login"),
  setupStartAtLoginNote: $("#setup-start-at-login-note"),
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
  setupChangeOnCheck: $("#setup-change-on-check"),
  setupCheckOptions: $("#setup-check-options"),
  setupTransitionOptions: $("#setup-transition-options"),
  setupCompletionSound: $("#setup-completion-sound"),
  groupByProject: $("#group-by-project"),
  preferOnTop: $("#prefer-on-top"),
  settingsDialog: $("#settings-dialog"),
  settingsBody: $(".settings-body"),
  settingsForm: $("#settings-form"),
  settingsClose: $("#settings-close"),
  settingsSave: $("#settings-save"),
  settingsSaveStatus: $("#settings-save-status"),
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
  reorderStatus: $("#reorder-status"),
  settingsChangeOnCheck: $("#settings-change-on-check"),
  settingsCheckOptions: $("#settings-check-options"),
  settingsTransitionOptions: $("#settings-transition-options"),
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
  "Set up task checkmarks",
  "Your viewing preferences",
  "Start good habits!"
];
const stepActions = ["Get started", "Continue", "Test connection", "Continue", "Continue", "Continue", "Continue", "Continue", "Save and show my tasks"];
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
let refreshQueued = false;
let settingsRevision = 0;
let taskRevision = 0;
let cachedTasks = [];
let hasTaskCache = false;
let connectionDraft = { baseUrl: "", workspaceSlug: "" };
let draftAssigneeIds;
let draftProjectIds;
let draftStateNames;
let draftCheckStateMappings = [];
let settingsDraftAssigneeIds;
let settingsDraftProjectIds;
let settingsDraftStateNames;
let settingsDraftMemberOrder;
let settingsDraftProjectOrder;
let settingsDraftStateOrder;
let settingsDraftCheckStateMappings = [];
let settingsScrollTop = 0;
let settingsSaveTimer;
let settingsSaveInFlight = false;
let settingsSaveAgain = false;
let settingsStartAtLoginDirty = false;
const windowDrag = window.planePinDrag.createDragTracker();
let suppressNextClick = false;
let dragFrame = 0;
let pendingDrag = null;
let isMac = false;
let updateState = { status: "idle", currentVersion: "", availableVersion: "", progress: 0 };
let activeTooltipTrigger = null;
const tooltipDescriptions = new WeakMap();

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

function positionTooltip() {
  if (!activeTooltipTrigger || elements.appTooltip.hidden) return;
  const trigger = activeTooltipTrigger.getBoundingClientRect();
  const tooltip = elements.appTooltip.getBoundingClientRect();
  const inset = 8;
  const gap = 7;
  let top = trigger.bottom + gap;
  if (top + tooltip.height > window.innerHeight - inset) {
    top = trigger.top - tooltip.height - gap;
  }
  const left = Math.max(
    inset,
    Math.min(window.innerWidth - tooltip.width - inset, trigger.left + (trigger.width - tooltip.width) / 2)
  );
  elements.appTooltip.style.left = `${Math.round(left)}px`;
  elements.appTooltip.style.top = `${Math.round(Math.max(inset, top))}px`;
}

function showTooltip(trigger) {
  const copy = trigger?.dataset.tooltip;
  if (!copy) return;
  if (activeTooltipTrigger && activeTooltipTrigger !== trigger) hideTooltip();
  activeTooltipTrigger = trigger;
  if (!tooltipDescriptions.has(trigger)) tooltipDescriptions.set(trigger, trigger.getAttribute("aria-describedby"));
  const describedBy = [tooltipDescriptions.get(trigger), elements.appTooltip.id].filter(Boolean).join(" ");
  trigger.setAttribute("aria-describedby", describedBy);
  elements.appTooltip.textContent = copy;
  elements.appTooltip.hidden = false;
  positionTooltip();
}

function hideTooltip() {
  if (activeTooltipTrigger) {
    const previous = tooltipDescriptions.get(activeTooltipTrigger);
    if (previous) activeTooltipTrigger.setAttribute("aria-describedby", previous);
    else activeTooltipTrigger.removeAttribute("aria-describedby");
  }
  activeTooltipTrigger = null;
  elements.appTooltip.hidden = true;
}

function installTooltips() {
  document.addEventListener("pointerover", (event) => {
    const trigger = event.target.closest?.("[data-tooltip]");
    if (trigger) showTooltip(trigger);
  });
  document.addEventListener("pointerout", (event) => {
    const trigger = event.target.closest?.("[data-tooltip]");
    if (trigger && !trigger.contains(event.relatedTarget) && document.activeElement !== trigger) hideTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const trigger = event.target.closest?.("[data-tooltip]");
    if (trigger) showTooltip(trigger);
  });
  document.addEventListener("focusout", (event) => {
    const trigger = event.target.closest?.("[data-tooltip]");
    if (trigger && !trigger.matches(":hover")) hideTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
  });
  document.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("resize", positionTooltip);
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

function clearReorderMarkers(container) {
  for (const item of container?.querySelectorAll(".drop-before, .drop-after") || []) {
    item.classList.remove("drop-before", "drop-after");
    delete item.dataset.dropPosition;
  }
}

let activeReorderValue = null;

function commitReorder(row, next, value, label, onReorder, restoreFocus) {
  const container = row.parentElement;
  const previousPositions = new Map(
    [...container.querySelectorAll(".selection-row")].map((item) => [
      item.dataset.reorderValue,
      item.getBoundingClientRect()
    ])
  );
  clearReorderMarkers(container);
  onReorder(next);
  requestAnimationFrame(() => {
    const rows = [...container.querySelectorAll(".selection-row")];
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const item of rows) {
        const previous = previousPositions.get(item.dataset.reorderValue);
        const current = item.getBoundingClientRect();
        const deltaY = previous ? previous.top - current.top : 0;
        if (deltaY && item.animate) {
          item.animate(
            [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
            { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
          );
        }
      }
    }
    const movedRow = rows.find((item) => item.dataset.reorderValue === value);
    if (restoreFocus) movedRow?.querySelector(".drag-handle")?.focus({ preventScroll: true });
    const position = next.indexOf(value) + 1;
    elements.reorderStatus.textContent = `Moved ${label} to position ${position} of ${next.length}.`;
  });
}

function addReorderHandle(row, value, label, orderedValues, onReorder) {
  row.dataset.reorderValue = value;
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.draggable = true;
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute(
    "aria-label",
    `Reorder ${label}, position ${orderedValues.indexOf(value) + 1} of ${orderedValues.length}`
  );
  handle.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
  handle.dataset.tooltip = `Drag to reorder ${label} - Alt+Up/Down`;
  handle.innerHTML = "<i></i><i></i><i></i>";

  const move = (direction) => {
    const next = moveOrderedValue(orderedValues, value, direction);
    if (next.every((item, index) => item === orderedValues[index])) return;
    commitReorder(row, next, value, label, onReorder, true);
  };
  handle.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    move(event.key === "ArrowUp" ? -1 : 1);
  });
  handle.addEventListener("click", (event) => event.preventDefault());
  handle.addEventListener("dragstart", (event) => {
    activeReorderValue = value;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", value);
    const bounds = row.getBoundingClientRect();
    event.dataTransfer.setDragImage(
      row,
      Math.max(0, event.clientX - bounds.left),
      Math.max(0, event.clientY - bounds.top)
    );
    row.classList.add("is-dragging");
  });
  handle.addEventListener("dragend", () => {
    activeReorderValue = null;
    row.classList.remove("is-dragging");
    clearReorderMarkers(row.parentElement);
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const dragged = activeReorderValue;
    clearReorderMarkers(row.parentElement);
    if (!dragged || dragged === value) return;
    const bounds = row.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    row.classList.add(position === "before" ? "drop-before" : "drop-after");
    row.dataset.dropPosition = position;
  });
  row.addEventListener("dragleave", (event) => {
    if (!row.contains(event.relatedTarget)) {
      row.classList.remove("drop-before", "drop-after");
      delete row.dataset.dropPosition;
    }
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain") || activeReorderValue;
    const next = dropOrderedValue(orderedValues, dragged, value, row.dataset.dropPosition);
    if (next.every((item, index) => item === orderedValues[index])) return;
    const draggedRow = [...row.parentElement.querySelectorAll(".selection-row")]
      .find((item) => item.dataset.reorderValue === dragged);
    commitReorder(draggedRow || row, next, dragged, draggedRow?.querySelector("strong")?.textContent || dragged, onReorder, false);
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
    if (reorder) addReorderHandle(label, state.name, state.name, orderedValues, reorder.onChange);
    return label;
  });
  container.replaceChildren(...rows);
}

function resolvedStateMappings(states, mappings, order) {
  const ordered = orderedItems(states, order, (state) => state.name);
  const available = new Set(ordered.map((state) => state.name.toLocaleLowerCase()));
  const current = new Map((mappings || [])
    .filter((mapping) => available.has(String(mapping.source).toLocaleLowerCase()))
    .map((mapping) => [String(mapping.source).toLocaleLowerCase(), {
      source: String(mapping.source),
      target: available.has(String(mapping.target).toLocaleLowerCase()) ? String(mapping.target) : ""
    }]));
  const defaults = defaultStateMappings(ordered, ordered.map((state) => state.name));
  const useDefaults = current.size === 0;
  return ordered.map((state) => current.get(state.name.toLocaleLowerCase())
    || (useDefaults
      ? defaults.find((mapping) => mapping.source === state.name)
      : { source: state.name, target: "" }));
}

function renderStateMappings(container, states, mappings, order, onChange) {
  const ordered = orderedItems(states, order, (state) => state.name);
  const resolved = resolvedStateMappings(ordered, mappings, ordered.map((state) => state.name));
  const mappingBySource = new Map(resolved.map((mapping) => [mapping.source.toLocaleLowerCase(), mapping]));
  container.replaceChildren(...ordered.map((state) => {
    const row = document.createElement("label");
    row.className = "state-mapping-row";
    const source = document.createElement("span");
    source.className = "state-mapping-source";
    const name = document.createElement("strong");
    name.textContent = state.name;
    source.append(stateGlyph(state.group, state.color), name);
    const arrow = document.createElement("span");
    arrow.className = "state-mapping-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Next state after ${state.name}`);
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "No change";
    select.append(none, ...ordered.filter((candidate) => candidate.name !== state.name).map((candidate) => {
      const option = document.createElement("option");
      option.value = candidate.name;
      option.textContent = candidate.name;
      return option;
    }));
    select.value = mappingBySource.get(state.name.toLocaleLowerCase())?.target || "";
    select.addEventListener("change", () => {
      const next = resolved.map((mapping) => mapping.source === state.name
        ? { source: mapping.source, target: select.value }
        : mapping);
      onChange(next);
    });
    row.append(source, arrow, select);
    return row;
  }));
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
    if (reorder) addReorderHandle(label, item.id, item.name, orderedValues, reorder.onChange);
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

function renderOnboardingCompletion() {
  const states = availableStates(discovery, draftProjectIds);
  draftCheckStateMappings = resolvedStateMappings(
    states,
    draftCheckStateMappings,
    states.map((state) => state.name)
  );
  renderStateMappings(
    elements.setupTransitionOptions,
    states,
    draftCheckStateMappings,
    states.map((state) => state.name),
    (next) => {
      draftCheckStateMappings = next;
      renderOnboardingCompletion();
    }
  );
  elements.setupCheckOptions.hidden = !elements.setupChangeOnCheck.checked;
}

function loginStartupStatusCopy(nextSettings = {}) {
  const status = nextSettings.loginStartupStatus || nextSettings.loginStartup?.status || "disabled";
  const platform = nextSettings.platform || "";
  const location = nextSettings.trayLocation || "system tray";
  if (status === "enabled") return `Configured: Plane Pin starts when you sign in and stays reachable in the ${location}.`;
  if (status === "configured") return "Registered to start when you sign in. The operating system has not confirmed startup approval yet.";
  if (status === "requires-approval") {
    return "macOS needs your approval. Open System Settings → General → Login Items and allow Plane Pin; unsigned builds cannot guarantee registration until you do.";
  }
  if (status === "blocked") {
    return platform === "win32"
      ? "Windows blocked this startup entry. Open Windows Settings → Apps → Startup, turn on Plane Pin, then save again to retry."
      : "The operating system blocked this startup entry. Turn it on in the operating system startup settings, then save again to retry.";
  }
  if (status === "invalid") {
    return platform === "linux"
      ? "The Linux autostart entry is invalid or stale. Turn this option off and on, then save to recreate it with the current app path."
      : "The startup entry is invalid or stale. Save again to retry, or reinstall Plane Pin if the problem continues.";
  }
  if (status === "error") return "Plane Pin could not verify startup right now. Save again to retry; check your operating system startup settings if it continues.";
  if (status === "not-found") return "macOS could not find the login item. Save again to retry after installing the packaged app.";
  if (status === "not-registered") return "Plane Pin is not registered to start at sign-in yet. Save again to retry.";
  if (status === "development") return "Development builds do not register at sign-in. Install the packaged app to use this setting.";
  if (status === "unknown") return "Plane Pin could not confirm its startup status. Save again to retry.";
  return nextSettings.startAtLogin
    ? "Plane Pin is set to start at sign-in. Save again if your operating system has not approved it yet."
    : "Plane Pin will not start automatically. You can change this later in Settings.";
}

function applyLoginStartupStatus(nextSettings) {
  elements.settingsStartAtLogin.checked = Boolean(nextSettings.startAtLogin);
  elements.settingsStartAtLoginNote.textContent = loginStartupStatusCopy(nextSettings);
  elements.settingsStartAtLoginNote.dataset.status = nextSettings.loginStartupStatus || "disabled";
}

function showStep(nextStep) {
  setupStep = nextStep;
  for (const panel of document.querySelectorAll(".setup-step")) {
    const active = Number(panel.dataset.step) === setupStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  elements.setupTitle.textContent = stepTitles[setupStep];
  elements.setupProgress.textContent = setupStep === 0 ? "Welcome" : `Step ${setupStep} of 8`;
  elements.setupNext.textContent = stepActions[setupStep];
  elements.setupBack.hidden = setupStep === 0;
  elements.setupError.textContent = "";
  requestAnimationFrame(() => {
    const panel = $(`.setup-step[data-step="${setupStep}"]`);
    const input = panel?.querySelector("input:not([type=hidden]), select, textarea, button");
    (input || elements.setupNext).focus();
  });
}

function openOnboarding() {
  discovery = null;
  draftAssigneeIds = settings.setupComplete ? [...(settings.assigneeIds || [])] : null;
  draftProjectIds = settings.setupComplete && Array.isArray(settings.projectIds) ? [...settings.projectIds] : null;
  draftStateNames = settings.setupComplete && Array.isArray(settings.stateNames) ? [...settings.stateNames] : null;
  draftCheckStateMappings = [...(settings.checkStateMappings || [])];
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
  elements.setupStartAtLogin.checked = settings.setupComplete ? settings.startAtLogin : true;
  elements.setupStartAtLoginNote.textContent = settings.setupComplete
    ? loginStartupStatusCopy(settings)
    : "Recommended. Plane Pin launches quietly at sign-in and stays reachable from the platform tray when one is available.";
  elements.setupChangeOnCheck.checked = settings.setupComplete ? settings.changeOnCheck : true;
  elements.setupCompletionSound.checked = settings.completionSound !== false;
  elements.setupCheckOptions.hidden = !elements.setupChangeOnCheck.checked;
  elements.memberFallback.hidden = true;
  elements.memberOptions.replaceChildren();
  elements.projectOptions.replaceChildren();
  elements.stateOptions.replaceChildren();
  elements.setupTransitionOptions.replaceChildren();
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
  if (setupStep === 5) {
    renderOnboardingCompletion();
    showStep(6);
    return;
  }
  if (setupStep === 6) return showStep(7);
  if (setupStep === 7) return showStep(8);

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
      changeOnCheck: elements.setupChangeOnCheck.checked,
      checkStateMappings: draftCheckStateMappings,
      completionSound: elements.setupCompletionSound.checked,
      groupByProject: elements.groupByProject.checked,
      alwaysOnTop: elements.preferOnTop.checked,
      startAtLogin: elements.setupStartAtLogin.checked,
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
    elements.setupNext.textContent = stepActions[8];
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
        scheduleSettingsSave();
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
        scheduleSettingsSave();
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
      scheduleSettingsSave();
    }
  });
  syncSelectionActions(elements.settingsStateOptions, elements.settingsStateSelectAll, elements.settingsStateSelectNone);
  renderSettingsCompletionOptions(states);
}

function renderSettingsCompletionOptions(states) {
  settingsDraftCheckStateMappings = resolvedStateMappings(
    states,
    settingsDraftCheckStateMappings,
    settingsDraftStateOrder
  );
  renderStateMappings(
    elements.settingsTransitionOptions,
    states,
    settingsDraftCheckStateMappings,
    settingsDraftStateOrder,
    (next) => {
      settingsDraftCheckStateMappings = next;
      renderSettingsCompletionOptions(states);
      scheduleSettingsSave();
    }
  );
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
  settingsStartAtLoginDirty = false;
  settingsDraftAssigneeIds = [...(settings.assigneeIds || [])];
  settingsDraftProjectIds = Array.isArray(settings.projectIds) ? [...settings.projectIds] : null;
  settingsDraftStateNames = Array.isArray(settings.stateNames) ? [...settings.stateNames] : null;
  settingsDraftMemberOrder = [...(settings.memberOrder || [])];
  settingsDraftProjectOrder = [...(settings.projectOrder || [])];
  settingsDraftStateOrder = [...(settings.stateOrder || [])];
  settingsDraftCheckStateMappings = [...(settings.checkStateMappings || [])];
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
  elements.settingsTransitionOptions.replaceChildren();
  elements.settingsCompletionSound.checked = settings.completionSound;
  elements.settingsOnTop.checked = settings.alwaysOnTop;
  elements.settingsCompactCards.checked = settings.compactCards;
  elements.settingsPriorityDot.checked = settings.priorityStyle !== "gradient";
  elements.settingsPriorityGradient.checked = settings.priorityStyle === "gradient";
  applyLoginStartupStatus(settings);
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
  if (!settingsView) return window.planePin.openSettingsWindow();
  hydrateSettingsForm();
  refreshUpdateState();
  elements.settingsError.textContent = "";
  if (!elements.settingsDialog.open) elements.settingsDialog.show();
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
  if (settingsSaveInFlight) {
    settingsSaveAgain = true;
    return;
  }
  settingsSaveInFlight = true;
  elements.settingsError.textContent = "";
  elements.settingsSaveStatus.textContent = "Saving…";
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
      checkStateMappings: settingsDraftCheckStateMappings,
      checkTargetStateName: "",
      completionSound: elements.settingsCompletionSound.checked,
      alwaysOnTop: elements.settingsOnTop.checked,
      compactCards: elements.settingsCompactCards.checked,
      priorityStyle: elements.settingsPriorityGradient.checked ? "gradient" : "dot",
      ...(settingsStartAtLoginDirty ? { startAtLogin: elements.settingsStartAtLogin.checked } : {}),
      closeToTray: elements.settingsCloseTray.checked,
      minimizeToTray: elements.settingsMinimizeTray.checked,
      refreshMinutes: Number(elements.settingsRefreshMinutes.value),
      theme: elements.settingsThemeDark.checked ? "dark" : "light"
    });
    settings = await window.planePin.getSettings();
    settingsStartAtLoginDirty = false;
    if (elements.settingsToken.value) {
      elements.settingsToken.value = "";
      elements.settingsToken.placeholder = "Saved securely — enter only to replace";
      elements.settingsTokenNote.textContent = "Leave blank to keep the encrypted token already saved.";
    }
    settingsRevision += 1;
    applySettingsToShell();
    elements.settingsSaveStatus.textContent = "All changes saved.";
    if (!settingsView) {
      scheduleAutoRefresh();
      renderCachedTasks();
      void refreshTasks({ quiet: true });
    }
  } catch (error) {
    elements.settingsError.textContent = error.message;
    elements.settingsSaveStatus.textContent = "Couldn’t save changes.";
  } finally {
    settingsSaveInFlight = false;
    if (settingsSaveAgain) {
      settingsSaveAgain = false;
      scheduleSettingsSave(0);
    }
  }
}

function scheduleSettingsSave(delay = 350) {
  if (!settingsView) return;
  clearTimeout(settingsSaveTimer);
  elements.settingsSaveStatus.textContent = "Unsaved changes…";
  settingsSaveTimer = setTimeout(saveSettingsForm, delay);
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

function celebrateTask(item, screenPoint) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion) {
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
    window.planePin.celebrateAt(screenPoint.x, screenPoint.y).catch(() => {
      // The state change already succeeded; a compositor without transparency
      // support should not turn celebration into a task error.
    });
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

function showStateTransition(item, task, result) {
  const transition = document.createElement("div");
  transition.className = "state-transition";
  transition.setAttribute("aria-hidden", "true");
  const from = document.createElement("span");
  from.className = "transition-state transition-from";
  from.append(stateGlyph(task.stateGroup, task.stateColor), document.createTextNode(task.stateName));
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.setAttribute("viewBox", "0 0 54 18");
  arrow.classList.add("transition-arrow");
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M2 9h45m-7-6 7 6-7 6");
  arrow.append(arrowPath);
  const to = document.createElement("span");
  to.className = "transition-state transition-to";
  to.append(stateGlyph(result.stateGroup, result.stateColor), document.createTextNode(result.stateName));
  transition.append(from, arrow, to);
  item.append(transition);
  requestAnimationFrame(() => item.classList.add("is-state-transitioning"));
}

function replaceCachedTask(nextTask) {
  const index = cachedTasks.findIndex((task) =>
    task.id === nextTask.id && task.projectId === nextTask.projectId);
  if (index < 0) cachedTasks.push(nextTask);
  else cachedTasks[index] = nextTask;
}

function createUndoToast(originalTask, result) {
  const toast = document.createElement("div");
  toast.className = "undo-toast";
  toast.setAttribute("role", "status");
  const message = document.createElement("span");
  message.textContent = `Moved ${originalTask.identifier} to ${result.stateName}.`;
  const undo = document.createElement("button");
  undo.type = "button";
  undo.textContent = "Undo";
  toast.append(message, undo);
  elements.undoToasts.append(toast);

  let remaining = 8000;
  let startedAt = Date.now();
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    toast.remove();
  };
  const resume = () => {
    if (!toast.isConnected || toast.classList.contains("is-error")) return;
    startedAt = Date.now();
    clearTimeout(timer);
    timer = setTimeout(dismiss, remaining);
  };
  const pause = () => {
    clearTimeout(timer);
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  };
  const undoChange = async () => {
    clearTimeout(timer);
    undo.disabled = true;
    message.textContent = `Restoring ${originalTask.identifier}...`;
    try {
      await window.planePin.undoTaskState(result.undoToken);
      taskRevision += 1;
      replaceCachedTask(originalTask);
      renderCachedTasks();
      dismiss();
      void refreshTasks({ quiet: true });
    } catch {
      toast.classList.add("is-error");
      message.textContent = `Couldn't undo ${originalTask.identifier}. Try again.`;
      undo.textContent = "Try again";
      undo.disabled = false;
    }
  };
  toast.addEventListener("pointerenter", pause);
  toast.addEventListener("pointerleave", resume);
  toast.addEventListener("focusin", pause);
  toast.addEventListener("focusout", (event) => {
    if (!toast.contains(event.relatedTarget)) resume();
  });
  undo.addEventListener("click", undoChange);
  resume();
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
  const targetStateName = settings.changeOnCheck
    ? targetForState(settings.checkStateMappings, task.stateName, settings.checkTargetStateName)
    : "";
  if (targetStateName) {
    item.classList.add("has-completion");
    const complete = document.createElement("button");
    complete.className = "complete-task";
    complete.type = "button";
    complete.setAttribute("aria-label", `Move ${task.identifier} to ${targetStateName}`);
    complete.dataset.tooltip = `Move to ${targetStateName}`;
    complete.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.2 8.2 3 3 6.6-6.5"></path></svg>';
    complete.addEventListener("click", async (event) => {
      event.stopPropagation();
      const screenPoint = { x: event.screenX, y: event.screenY };
      complete.disabled = true;
      item.classList.add("is-checking");
      try {
        const originalTask = { ...task };
        const result = await window.planePin.changeTaskState(task.id, task.projectId);
        taskRevision += 1;
        replaceCachedTask({
          ...task,
          stateName: result.stateName,
          stateGroup: result.stateGroup,
          stateColor: result.stateColor
        });
        item.classList.remove("is-checking");
        item.classList.add("is-checked");
        showStateTransition(item, task, result);
        if (shouldCelebrateTransition(result)) celebrateTask(item, screenPoint);
        createUndoToast(originalTask, result);
        setTimeout(() => {
          renderCachedTasks();
          void refreshTasks({ quiet: true });
        }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 2050);
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

function groupSection(row) {
  const section = document.createElement("li");
  section.className = `group-section ${row.type}-section${row.nested ? " is-nested" : ""}`;
  const heading = document.createElement("button");
  heading.type = "button";
  heading.className = `${row.type}-heading`;
  const name = document.createElement("span");
  name.textContent = row.name;
  const trailing = document.createElement("span");
  trailing.className = "group-heading-trailing";
  const total = document.createElement("span");
  total.textContent = String(row.count);
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 16 16");
  chevron.setAttribute("aria-hidden", "true");
  chevron.classList.add("group-chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m6 3 5 5-5 5");
  chevron.append(path);
  trailing.append(total, chevron);
  heading.append(name, trailing);

  const collapse = document.createElement("div");
  collapse.className = "group-collapse";
  collapse.id = `group-${row.key.replace(/[^a-z0-9_-]/gi, "-")}`;
  const items = document.createElement("ul");
  items.className = "group-items";
  collapse.append(items);
  heading.setAttribute("aria-controls", collapse.id);

  const applyCollapsed = (collapsed) => {
    section.classList.toggle("is-collapsed", collapsed);
    heading.setAttribute("aria-expanded", String(!collapsed));
    collapse.setAttribute("aria-hidden", String(collapsed));
    collapse.inert = collapsed;
  };
  applyCollapsed((settings.collapsedGroupKeys || []).includes(row.key));
  heading.addEventListener("click", async () => {
    const previous = [...(settings.collapsedGroupKeys || [])];
    const collapsed = !section.classList.contains("is-collapsed");
    const next = new Set(previous);
    if (collapsed) next.add(row.key);
    else next.delete(row.key);
    settings.collapsedGroupKeys = [...next];
    applyCollapsed(collapsed);
    try {
      settings.collapsedGroupKeys = await window.planePin.setPreference(
        "collapsedGroupKeys",
        settings.collapsedGroupKeys
      );
    } catch (error) {
      settings.collapsedGroupKeys = previous;
      applyCollapsed(!collapsed);
      elements.status.textContent = "Couldn't save collapsed groups";
      elements.count.textContent = error.message;
    }
  });
  section.append(heading, collapse);
  return { section, items };
}

function filterTitle() {
  if (settings.stateNames === null) return "All selected tasks";
  if (settings.stateNames.length === 0) return "No workflow states";
  if (settings.stateNames.length === 1) return settings.stateNames[0];
  return `${settings.stateNames.length} workflow states`;
}

function renderTasks(tasks) {
  const root = document.createDocumentFragment();
  let memberItems = null;
  let projectItems = null;
  for (const row of layoutTasks(tasks, settings)) {
    if (row.type === "member") {
      const group = groupSection(row);
      root.append(group.section);
      memberItems = group.items;
      projectItems = null;
    } else if (row.type === "project") {
      const group = groupSection(row);
      (memberItems || root).append(group.section);
      projectItems = group.items;
    } else {
      (projectItems || memberItems || root).append(taskRow(row.task));
    }
  }
  elements.taskList.replaceChildren(root);
  elements.taskList.hidden = tasks.length === 0;
  elements.empty.hidden = tasks.length > 0;
  elements.listTitle.textContent = filterTitle();
  elements.empty.querySelector("h2").textContent = "No tasks match.";
  elements.empty.querySelector("p").textContent = "Choose more members, projects, or workflow states in Settings.";
  $("#start-setup").textContent = settings.setupComplete ? "Open settings" : "Set up Plane Pin";
  elements.count.textContent = `${tasks.length} selected ${tasks.length === 1 ? "task" : "tasks"}`;
  elements.status.textContent = settings.memberName ? `Connected as ${settings.memberName}` : "Connected";
}

function renderCachedTasks() {
  if (!hasTaskCache) return;
  renderTasks(filterTasks(cachedTasks, settings));
}

async function refreshTasks(options = {}) {
  const quiet = Boolean(options.quiet);
  if (!settings.tokenSet) return;
  if (refreshing) {
    refreshQueued = true;
    return;
  }
  refreshing = true;
  const requestedSettingsRevision = settingsRevision;
  const requestedTaskRevision = taskRevision;
  elements.refresh.disabled = true;
  elements.refresh.classList.add("is-refreshing");
  const previousStatus = elements.status.textContent;
  elements.status.textContent = "Refreshing…";
  if (quiet) elements.status.textContent = previousStatus;
  try {
    const tasks = await window.planePin.listTasks();
    if (requestedSettingsRevision !== settingsRevision || requestedTaskRevision !== taskRevision) {
      refreshQueued = true;
      return;
    }
    cachedTasks = tasks;
    hasTaskCache = true;
    renderCachedTasks();
  } catch (error) {
    if (hasTaskCache) {
      renderCachedTasks();
      elements.status.textContent = "Couldn't refresh - showing saved results";
      return;
    }
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
    if (refreshQueued) {
      refreshQueued = false;
      queueMicrotask(() => refreshTasks({ quiet: true }));
    }
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
  applyLoginStartupStatus(settings);
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
elements.refresh.addEventListener("click", () => refreshTasks());
elements.settingsOpen.addEventListener("click", openSettings);
$("#start-setup").addEventListener("click", () => settings.setupComplete ? openSettings() : openOnboarding());
$("#window-minimize").addEventListener("click", window.planePin.minimizeWindow);
$("#window-maximize").addEventListener("click", window.planePin.toggleMaximizeWindow);
$("#window-close").addEventListener("click", window.planePin.closeWindow);

elements.setupClose.addEventListener("click", () => elements.setup.close());
elements.setupLater.addEventListener("click", () => elements.setup.close());
elements.setupBack.addEventListener("click", () => showStep(Math.max(0, setupStep - 1)));
elements.setupChangeOnCheck.addEventListener("change", () => {
  elements.setupCheckOptions.hidden = !elements.setupChangeOnCheck.checked;
});
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

const closeSettings = () => settingsView
  ? window.planePin.closeSettingsWindow()
  : elements.settingsDialog.close();
elements.settingsClose.addEventListener("click", closeSettings);
elements.settingsSave.addEventListener("click", closeSettings);
elements.settingsBody.addEventListener("scroll", () => {
  settingsScrollTop = elements.settingsBody.scrollTop;
});
elements.settingsTokenVisibility.addEventListener("click", () =>
  togglePassword(elements.settingsToken, elements.settingsTokenVisibility));
elements.settingsChangeOnCheck.addEventListener("change", () => {
  elements.settingsCheckOptions.hidden = !elements.settingsChangeOnCheck.checked;
});
elements.settingsForm.addEventListener("change", () => scheduleSettingsSave());
elements.settingsStartAtLogin.addEventListener("change", () => {
  settingsStartAtLoginDirty = true;
  scheduleSettingsSave();
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
    scheduleSettingsSave(0);
  } catch {
    // Error is already visible beside the action.
  }
});
elements.settingsMemberSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsMemberOptions, true, () => {
    settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
    renderSettingsMembers();
    scheduleSettingsSave();
  }));
elements.settingsMemberSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsMemberOptions, false, () => {
    settingsDraftAssigneeIds = selectedValues(elements.settingsMemberOptions);
    renderSettingsMembers();
    scheduleSettingsSave();
  }));
elements.settingsProjectSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsProjectOptions, true, () => {
    settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
    renderSettingsProjects();
    renderSettingsStates();
    scheduleSettingsSave();
  }));
elements.settingsProjectSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsProjectOptions, false, () => {
    settingsDraftProjectIds = selectedValues(elements.settingsProjectOptions);
    renderSettingsProjects();
    renderSettingsStates();
    scheduleSettingsSave();
  }));
elements.settingsStateSelectAll.addEventListener("click", () =>
  setEverySelection(elements.settingsStateOptions, true, () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    renderSettingsStates();
    scheduleSettingsSave();
  }));
elements.settingsStateSelectNone.addEventListener("click", () =>
  setEverySelection(elements.settingsStateOptions, false, () => {
    settingsDraftStateNames = selectedValues(elements.settingsStateOptions);
    renderSettingsStates();
    scheduleSettingsSave();
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
window.planePin.onSettingsChanged((nextSettings) => {
  if (settingsView) return;
  settings = nextSettings;
  settingsRevision += 1;
  applySettingsToShell();
  renderCachedTasks();
  scheduleAutoRefresh();
  void refreshTasks({ quiet: true });
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
  if (settingsView) {
    document.title = "Plane Pin Settings";
    await openSettings();
    return;
  }
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

installTooltips();
init();
