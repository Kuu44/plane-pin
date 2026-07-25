"use strict";

const elements = {
  pin: document.querySelector("#pin"),
  status: document.querySelector("#status"),
  count: document.querySelector("#count"),
  listTitle: document.querySelector("#list-title"),
  refresh: document.querySelector("#refresh"),
  settings: document.querySelector("#settings"),
  form: document.querySelector("#settings-form"),
  baseUrl: document.querySelector("#base-url"),
  workspaceSlug: document.querySelector("#workspace-slug"),
  memberId: document.querySelector("#member-id"),
  projectScope: document.querySelector("#project-scope"),
  projectId: document.querySelector("#project-id"),
  projectRefField: document.querySelector("#project-ref-field"),
  statusGroup: document.querySelector("#status-group"),
  groupByProject: document.querySelector("#group-by-project"),
  apiToken: document.querySelector("#api-token"),
  tokenVisibility: document.querySelector("#token-visibility"),
  tokenHint: document.querySelector("#token-hint"),
  formError: document.querySelector("#form-error"),
  save: document.querySelector("#save"),
  empty: document.querySelector("#empty"),
  taskList: document.querySelector("#task-list")
};

let settings;
const statusLabels = {
  backlog: "Backlog",
  unstarted: "Todo",
  started: "In progress",
  completed: "Completed",
  cancelled: "Cancelled"
};

function updateProjectField() {
  const singleProject = elements.projectScope.value === "single";
  elements.projectRefField.hidden = !singleProject;
  elements.projectId.required = singleProject;
}

function openSettings() {
  elements.baseUrl.value = settings.baseUrl || "";
  elements.workspaceSlug.value = settings.workspaceSlug || "";
  elements.memberId.value = settings.memberId || "";
  elements.projectScope.value = settings.projectScope || "all";
  elements.projectId.value = settings.projectId || "";
  elements.statusGroup.value = settings.statusGroup || "started";
  elements.groupByProject.checked = settings.groupByProject;
  updateProjectField();
  elements.apiToken.value = "";
  elements.apiToken.type = "password";
  elements.tokenVisibility.textContent = "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", "false");
  elements.apiToken.required = !settings.tokenSet;
  elements.apiToken.placeholder = settings.tokenSet ? "Saved securely — leave blank to keep" : "plane_api_…";
  elements.tokenHint.textContent = settings.tokenSet
    ? "A token is saved securely. Enter a new one only to replace it."
    : "Create one in Plane → Profile settings → Personal access tokens.";
  elements.formError.textContent = "";
  elements.settings.showModal();
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
  const status = statusLabels[settings.statusGroup];
  elements.listTitle.textContent = status;
  elements.empty.querySelector("h2").textContent = tasks.length ? "" : `Nothing in ${status.toLowerCase()}.`;
  elements.empty.querySelector("p").textContent = tasks.length
    ? ""
    : "Assigned tasks will appear here when they enter this status group.";
  elements.empty.querySelector("#connect").hidden = true;
  elements.count.textContent = `${tasks.length} assigned ${tasks.length === 1 ? "task" : "tasks"}`;
  elements.status.textContent = "Connected";
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
    elements.empty.querySelector("h2").textContent = settings.tokenSet ? "Couldn’t load Plane." : "Connect Plane first.";
    elements.empty.querySelector("p").textContent = error.message;
    elements.empty.querySelector("#connect").hidden = false;
  } finally {
    elements.refresh.disabled = false;
  }
}

elements.pin.addEventListener("change", async () => {
  settings.alwaysOnTop = await window.planePin.setAlwaysOnTop(elements.pin.checked);
});
elements.refresh.addEventListener("click", refreshTasks);
document.querySelector("#settings-open").addEventListener("click", openSettings);
document.querySelector("#connect").addEventListener("click", openSettings);
document.querySelector("#settings-close").addEventListener("click", () => elements.settings.close());
elements.projectScope.addEventListener("change", updateProjectField);
elements.tokenVisibility.addEventListener("click", () => {
  const visible = elements.apiToken.type === "password";
  elements.apiToken.type = visible ? "text" : "password";
  elements.tokenVisibility.textContent = visible ? "Hide" : "Show";
  elements.tokenVisibility.setAttribute("aria-pressed", String(visible));
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.save.disabled = true;
  elements.formError.textContent = "";
  try {
    await window.planePin.saveSettings({
      baseUrl: elements.baseUrl.value,
      workspaceSlug: elements.workspaceSlug.value,
      memberId: elements.memberId.value,
      projectScope: elements.projectScope.value,
      projectId: elements.projectId.value,
      statusGroup: elements.statusGroup.value,
      groupByProject: elements.groupByProject.checked,
      apiToken: elements.apiToken.value,
      alwaysOnTop: elements.pin.checked
    });
    settings = await window.planePin.getSettings();
    elements.settings.close();
    await refreshTasks();
  } catch (error) {
    elements.formError.textContent = error.message;
  } finally {
    elements.save.disabled = false;
  }
});

async function init() {
  settings = await window.planePin.getSettings();
  elements.pin.checked = settings.alwaysOnTop;
  elements.listTitle.textContent = statusLabels[settings.statusGroup];
  const connected = Boolean(settings.baseUrl && settings.memberId && settings.tokenSet);
  elements.refresh.disabled = !connected;
  if (connected) await refreshTasks();
}

init();
