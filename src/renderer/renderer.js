"use strict";

const elements = {
  pinToggle: document.querySelector("#pin-toggle"),
  pinLabel: document.querySelector("#pin-label"),
  compactToggle: document.querySelector("#compact-toggle"),
  compactHint: document.querySelector("#compact-hint"),
  status: document.querySelector("#status"),
  count: document.querySelector("#count"),
  listTitle: document.querySelector("#list-title"),
  refresh: document.querySelector("#refresh"),
  settingsOpen: document.querySelector("#settings-open"),
  empty: document.querySelector("#empty"),
  taskList: document.querySelector("#task-list"),
  setup: document.querySelector("#setup"),
  setupForm: document.querySelector("#setup-form"),
  setupTitle: document.querySelector("#setup-title"),
  setupProgress: document.querySelector("#setup-progress"),
  setupClose: document.querySelector("#setup-close"),
  setupLater: document.querySelector("#setup-later"),
  setupBack: document.querySelector("#setup-back"),
  setupNext: document.querySelector("#setup-next"),
  setupError: document.querySelector("#setup-error"),
  planePageUrl: document.querySelector("#plane-page-url"),
  apiToken: document.querySelector("#api-token"),
  tokenVisibility: document.querySelector("#token-visibility"),
  tokenRecovery: document.querySelector("#token-recovery"),
  memberSummary: document.querySelector("#member-summary"),
  memberFallback: document.querySelector("#member-fallback"),
  profileUrl: document.querySelector("#profile-url"),
  projectAll: document.querySelector("#project-all"),
  projectSingle: document.querySelector("#project-single"),
  projectSelectField: document.querySelector("#project-select-field"),
  projectId: document.querySelector("#project-id"),
  stateAll: document.querySelector("#state-all"),
  stateSelected: document.querySelector("#state-selected"),
  stateOptions: document.querySelector("#state-options"),
  groupByProject: document.querySelector("#group-by-project"),
  preferOnTop: document.querySelector("#prefer-on-top")
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
const groupOrder = ["backlog", "unstarted", "started", "completed", "cancelled"];

let settings;
let discovery;
let setupStep = 0;
let compactMode = false;
let compactHintTimer;
let connectionDraft = { baseUrl: "", workspaceSlug: "" };
let draftStateNames = [];

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

function setPinVisual(enabled) {
  elements.pinToggle.setAttribute("aria-pressed", String(enabled));
  elements.pinLabel.textContent = enabled ? "On top" : "Normal window";
  elements.pinToggle.dataset.tooltip = `${enabled ? "Turn off always on top" : "Keep above other apps"} · Ctrl+Shift+T`;
}

async function togglePin() {
  const enabled = elements.pinToggle.getAttribute("aria-pressed") !== "true";
  settings.alwaysOnTop = await window.planePin.setAlwaysOnTop(enabled);
  elements.preferOnTop.checked = settings.alwaysOnTop;
  setPinVisual(settings.alwaysOnTop);
}

function setCompactMode(enabled) {
  compactMode = enabled;
  document.body.classList.toggle("compact-mode", enabled);
  elements.compactToggle.setAttribute("aria-label", enabled ? "Show controls" : "Hide controls");
  elements.compactToggle.dataset.tooltip = `${enabled ? "Show controls" : "Hide controls"} · Ctrl+Shift+H`;
  if (enabled) {
    clearTimeout(compactHintTimer);
    elements.compactHint.classList.add("show");
    compactHintTimer = setTimeout(() => elements.compactHint.classList.remove("show"), 2800);
  } else {
    elements.compactHint.classList.remove("show");
  }
}

function updateProjectChoice() {
  elements.projectSelectField.hidden = !elements.projectSingle.checked;
  if (setupStep === 4) renderStateOptions();
}

function relevantProjects() {
  if (!discovery) return [];
  return elements.projectSingle.checked
    ? discovery.projects.filter((project) => project.id === elements.projectId.value)
    : discovery.projects;
}

function availableStates() {
  const states = new Map();
  for (const project of relevantProjects()) {
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

function renderStateOptions() {
  const selectedNames = new Set(draftStateNames.map((name) => name.toLocaleLowerCase()));
  const rows = availableStates().map((state) => {
    const label = document.createElement("label");
    label.className = "state-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = state.name;
    input.checked = selectedNames.has(state.name.toLocaleLowerCase());
    input.addEventListener("change", () => {
      draftStateNames = selectedStateNames();
    });
    const dot = document.createElement("span");
    dot.className = "state-dot";
    if (/^#[0-9a-f]{6}$/i.test(state.color)) dot.style.setProperty("--state-color", state.color);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = state.name;
    const group = document.createElement("small");
    group.textContent = stateGroupLabels[state.group] || "Workflow state";
    copy.append(name, group);
    label.append(input, dot, copy);
    return label;
  });
  elements.stateOptions.replaceChildren(...rows);
  elements.stateOptions.hidden = !elements.stateSelected.checked;
}

function populateProjects() {
  const options = discovery.projects.map((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.identifier ? `${project.identifier} — ${project.name}` : project.name;
    return option;
  });
  elements.projectId.replaceChildren(...options);
  const selectedProject = discovery.projects.find((project) =>
    project.id === settings.projectId
    || project.identifier.toLocaleLowerCase() === String(settings.projectId || "").toLocaleLowerCase()
  );
  if (selectedProject) elements.projectId.value = selectedProject.id;
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
    const input = document.querySelector(`.setup-step[data-step="${setupStep}"] input:not([type="radio"]):not([type="checkbox"])`);
    (input || elements.setupNext).focus();
  });
}

function openSetup(mode = "settings") {
  discovery = null;
  draftStateNames = [...(settings.stateNames || [])];
  connectionDraft = { baseUrl: settings.baseUrl || "", workspaceSlug: settings.workspaceSlug || "" };
  elements.planePageUrl.value = settings.baseUrl && settings.workspaceSlug
    ? `${settings.baseUrl}/${settings.workspaceSlug}/`
    : "";
  elements.apiToken.value = "";
  elements.apiToken.type = "password";
  elements.apiToken.placeholder = settings.tokenSet ? "Saved securely — leave blank to keep" : "plane_api_…";
  elements.tokenVisibility.textContent = "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", "false");
  elements.tokenRecovery.hidden = !settings.tokenError;
  elements.profileUrl.value = settings.memberId ? `/profile/${settings.memberId}/assigned/` : "";
  elements.projectAll.checked = settings.projectScope !== "single";
  elements.projectSingle.checked = settings.projectScope === "single";
  elements.stateAll.checked = settings.stateFilterMode !== "selected";
  elements.stateSelected.checked = settings.stateFilterMode === "selected";
  elements.groupByProject.checked = settings.groupByProject;
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.memberFallback.hidden = true;
  updateProjectChoice();
  showStep(mode === "first" ? 0 : settings.tokenError ? 2 : 1);
  if (!elements.setup.open) elements.setup.showModal();
}

function selectedStateNames() {
  return [...elements.stateOptions.querySelectorAll("input:checked")].map((input) => input.value);
}

function taskRow(task) {
  const row = document.createElement("li");
  row.className = "task-row";

  const priority = document.createElement("span");
  priority.className = `priority ${task.priority}`;
  priority.title = `${task.priority} priority`;
  priority.setAttribute("role", "img");
  priority.setAttribute("aria-label", `${task.priority} priority`);

  const body = document.createElement("div");
  const name = document.createElement("p");
  name.className = "task-name";
  name.textContent = task.name;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const identifier = document.createElement("span");
  identifier.className = "task-identifier";
  identifier.textContent = task.identifier;
  const state = document.createElement("span");
  state.textContent = task.stateName;
  meta.append(identifier, state);
  if (task.targetDate) {
    const due = document.createElement("span");
    due.textContent = `Due ${task.targetDate}`;
    meta.append(due);
  }

  body.append(name, meta);
  row.append(priority, body);
  return row;
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
    const projects = Map.groupBy(tasks, (task) => task.projectName);
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
  document.querySelector("#start-setup").textContent = "Open settings";
  elements.count.textContent = `${tasks.length} assigned ${tasks.length === 1 ? "task" : "tasks"}`;
  elements.status.textContent = settings.memberName ? `Connected as ${settings.memberName}` : "Connected";
}

async function refreshTasks() {
  elements.refresh.disabled = true;
  elements.status.textContent = "Refreshing…";
  try {
    renderTasks(await window.planePin.listTasks());
  } catch (error) {
    elements.status.textContent = "Needs attention";
    elements.count.textContent = error.message;
    elements.taskList.hidden = true;
    elements.empty.hidden = false;
    elements.empty.querySelector("h2").textContent = "Couldn’t load Plane.";
    elements.empty.querySelector("p").textContent = error.message;
    document.querySelector("#start-setup").textContent = "Check settings";
  } finally {
    elements.refresh.disabled = false;
  }
}

async function advanceSetup() {
  if (setupStep === 0) {
    showStep(1);
    return;
  }
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
      discovery = await window.planePin.discoverWorkspace({
        ...connectionDraft,
        apiToken: elements.apiToken.value
      });
      populateProjects();
      const member = discovery.member || (settings.memberId ? {
        id: settings.memberId,
        name: settings.memberName || "your saved Plane account"
      } : null);
      elements.memberSummary.textContent = member
        ? `Connected as ${member.name}. We found ${discovery.projects.length} ${discovery.projects.length === 1 ? "project" : "projects"}.`
        : `Connection works. We found ${discovery.projects.length} projects, but this Plane version needs your profile link too.`;
      elements.memberFallback.hidden = Boolean(member);
      updateProjectChoice();
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
    if (!discovery) {
      showStep(2);
      return;
    }
    if (elements.projectSingle.checked && !elements.projectId.value) {
      elements.setupError.textContent = "Choose a project.";
      return;
    }
    const memberId = discovery.member?.id || settings.memberId || memberIdFromProfile(elements.profileUrl.value);
    if (!memberId) {
      elements.setupError.textContent = "Paste your My Work page address so Plane Pin can identify your account.";
      return;
    }
    renderStateOptions();
    showStep(4);
    return;
  }
  if (setupStep === 4) {
    draftStateNames = selectedStateNames();
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
      alwaysOnTop: elements.preferOnTop.checked
    });
    settings = await window.planePin.getSettings();
    setPinVisual(settings.alwaysOnTop);
    elements.setup.close();
    await refreshTasks();
  } catch (error) {
    elements.setupError.textContent = error.message;
  } finally {
    elements.setupNext.disabled = false;
    elements.setupNext.textContent = stepActions[5];
  }
}

elements.pinToggle.addEventListener("click", togglePin);
elements.compactToggle.addEventListener("click", () => setCompactMode(!compactMode));
elements.refresh.addEventListener("click", refreshTasks);
elements.settingsOpen.addEventListener("click", () => openSetup("settings"));
document.querySelector("#start-setup").addEventListener("click", () => openSetup("settings"));
elements.setupClose.addEventListener("click", () => elements.setup.close());
elements.setupLater.addEventListener("click", () => elements.setup.close());
elements.setupBack.addEventListener("click", () => showStep(Math.max(0, setupStep - 1)));
elements.projectAll.addEventListener("change", updateProjectChoice);
elements.projectSingle.addEventListener("change", updateProjectChoice);
elements.projectId.addEventListener("change", () => {
  if (setupStep === 4) renderStateOptions();
});
elements.stateAll.addEventListener("change", renderStateOptions);
elements.stateSelected.addEventListener("change", renderStateOptions);
elements.tokenVisibility.addEventListener("click", () => {
  const visible = elements.apiToken.type === "password";
  elements.apiToken.type = visible ? "text" : "password";
  elements.tokenVisibility.textContent = visible ? "Hide" : "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", String(visible));
});
elements.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.setupError.textContent = "";
  await advanceSetup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && compactMode && !elements.setup.open) {
    event.preventDefault();
    setCompactMode(false);
    return;
  }
  if (!event.ctrlKey || !event.shiftKey) {
    if (event.ctrlKey && event.key === ",") {
      event.preventDefault();
      openSetup("settings");
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
  } else if (key === "r" && !elements.refresh.disabled) {
    event.preventDefault();
    refreshTasks();
  }
});

async function init() {
  settings = await window.planePin.getSettings();
  setPinVisual(settings.alwaysOnTop);
  elements.preferOnTop.checked = settings.alwaysOnTop;
  elements.listTitle.textContent = filterTitle();
  const connected = Boolean(settings.setupComplete && settings.baseUrl && settings.memberId && settings.tokenSet);
  elements.refresh.disabled = !connected;
  if (connected) {
    await refreshTasks();
  } else {
    elements.status.textContent = settings.tokenError ? "Reconnect required" : "Setup not finished";
    requestAnimationFrame(() => openSetup(settings.tokenError ? "recovery" : "first"));
  }
}

init();
