"use strict";

const elements = {
  pin: document.querySelector("#pin"),
  status: document.querySelector("#status"),
  count: document.querySelector("#count"),
  refresh: document.querySelector("#refresh"),
  settings: document.querySelector("#settings"),
  form: document.querySelector("#settings-form"),
  baseUrl: document.querySelector("#base-url"),
  workspaceSlug: document.querySelector("#workspace-slug"),
  projectId: document.querySelector("#project-id"),
  apiToken: document.querySelector("#api-token"),
  tokenVisibility: document.querySelector("#token-visibility"),
  tokenHint: document.querySelector("#token-hint"),
  formError: document.querySelector("#form-error"),
  save: document.querySelector("#save"),
  empty: document.querySelector("#empty"),
  taskList: document.querySelector("#task-list")
};

let settings;

function openSettings() {
  elements.baseUrl.value = settings.baseUrl || "";
  elements.workspaceSlug.value = settings.workspaceSlug || "";
  elements.projectId.value = settings.projectId || "";
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

function renderTasks(tasks) {
  elements.taskList.replaceChildren(...tasks.map((task) => {
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
  }));

  elements.taskList.hidden = tasks.length === 0;
  elements.empty.hidden = tasks.length > 0;
  elements.empty.querySelector("h2").textContent = tasks.length ? "" : "Nothing is in progress.";
  elements.empty.querySelector("p").textContent = tasks.length
    ? ""
    : "Tasks will appear here when their Plane state moves into the Started group.";
  elements.empty.querySelector("#connect").hidden = true;
  elements.count.textContent = `${tasks.length} active ${tasks.length === 1 ? "task" : "tasks"}`;
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
      projectId: elements.projectId.value,
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
  const connected = Boolean(settings.baseUrl && settings.tokenSet);
  elements.refresh.disabled = !connected;
  if (connected) await refreshTasks();
}

init();
