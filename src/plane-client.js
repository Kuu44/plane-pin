"use strict";

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Plane URL must use HTTPS (HTTP is allowed only for localhost).");
  }
  return url.origin;
}

function asPage(payload) {
  if (Array.isArray(payload)) return { results: payload, nextCursor: null };
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("Plane returned an unexpected response.");
  }
  return {
    results: payload.results,
    nextCursor: payload.next_page_results ? payload.next_cursor : null
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildTaskUrl(baseUrl, workspaceSlug, task) {
  const identifier = task.project?.identifier && task.sequence_id
    ? `${task.project.identifier}-${task.sequence_id}`
    : "";
  if (!identifier) throw new Error("Plane did not return a browsable task identifier.");
  return new URL(
    `/${encodeURIComponent(workspaceSlug)}/browse/${encodeURIComponent(identifier)}/`,
    normalizeBaseUrl(baseUrl)
  ).toString();
}

async function fetchPages(initialUrl, apiToken, request) {
  const results = [];
  let cursor = null;

  for (let pageNumber = 0; pageNumber < 50; pageNumber += 1) {
    const url = new URL(initialUrl);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await request(url, {
      headers: { Accept: "application/json", "X-API-Key": apiToken }
    });

    if (!response.ok) {
      const detail = response.status === 401 || response.status === 403
        ? "Check the API token and its workspace access."
        : `Plane returned HTTP ${response.status}.`;
      throw new Error(detail);
    }

    const page = asPage(await response.json());
    results.push(...page.results);
    if (!page.nextCursor) return results;
    cursor = page.nextCursor;
  }

  throw new Error("Plane returned more pages than the app can safely load.");
}

async function fetchCurrentUser(baseUrl, apiToken, request) {
  const response = await request(new URL("/api/v1/users/me/", baseUrl), {
    headers: { Accept: "application/json", "X-API-Key": apiToken }
  });
  if (response.status === 404 || response.status === 405) return null;
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? "Check the API token and its workspace access."
      : `Plane returned HTTP ${response.status}.`);
  }
  return response.json();
}

async function fetchProjects(baseUrl, workspace, apiToken, request) {
  const projectsUrl = new URL(`/api/v1/workspaces/${workspace}/projects/`, baseUrl);
  projectsUrl.searchParams.set("per_page", "100");
  return fetchPages(projectsUrl, apiToken, request);
}

async function fetchStates(baseUrl, workspace, projectId, apiToken, request) {
  const statesUrl = new URL(
    `/api/v1/workspaces/${workspace}/projects/${encodeURIComponent(projectId)}/states/`,
    baseUrl
  );
  statesUrl.searchParams.set("per_page", "100");
  return fetchPages(statesUrl, apiToken, request);
}

function selectProjects(projects, config) {
  const selected = config.projectScope === "single"
    ? projects.filter((project) => project.id === config.projectId
      || String(project.identifier).toLowerCase() === String(config.projectId).toLowerCase())
    : projects;
  if (config.projectScope === "single" && selected.length === 0) {
    throw new Error(`No Plane project uses the ID or key "${config.projectId}".`);
  }
  return selected;
}

async function discoverWorkspace(config, request = fetch) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const workspace = encodeURIComponent(config.workspaceSlug);
  const projects = await fetchProjects(baseUrl, workspace, config.apiToken, request);
  const currentUser = await fetchCurrentUser(baseUrl, config.apiToken, request);
  const projectsWithStates = await Promise.all(projects.map(async (project) => ({
    id: String(project.id),
    identifier: String(project.identifier || ""),
    name: String(project.name || project.identifier || "Untitled project"),
    states: (await fetchStates(baseUrl, workspace, project.id, config.apiToken, request)).map((state) => ({
      id: String(state.id),
      name: String(state.name || "Unnamed state"),
      group: String(state.group || ""),
      color: String(state.color || "")
    }))
  })));

  return {
    member: currentUser?.id ? {
      id: String(currentUser.id),
      name: String(currentUser.display_name
        || [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ")
        || currentUser.email
        || "Plane user")
    } : null,
    projects: projectsWithStates
  };
}

async function fetchAssignedTasks(config, request = fetch) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const workspace = encodeURIComponent(config.workspaceSlug);
  const projects = await fetchProjects(baseUrl, workspace, config.apiToken, request);
  const selectedProjects = selectProjects(projects, config);
  const selectedStateNames = new Set(
    config.stateFilterMode === "selected"
      ? (config.stateNames || []).map((name) => String(name).toLocaleLowerCase())
      : []
  );

  const projectTasks = await Promise.all(selectedProjects.map(async (project) => {
    const url = new URL(`/api/v1/workspaces/${workspace}/projects/${encodeURIComponent(project.id)}/work-items/`, baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("expand", "state,project");
    url.searchParams.set("assignee", config.memberId);
    const [tasks, states] = await Promise.all([
      fetchPages(url, config.apiToken, request),
      fetchStates(baseUrl, workspace, project.id, config.apiToken, request)
    ]);
    const statesById = new Map(states.map((state) => [String(state.id), state]));
    return tasks
      .map((task) => {
        const state = typeof task.state === "object" && task.state
          ? task.state
          : statesById.get(String(task.state));
        return {
          ...task,
          state,
          project: {
            id: project.id,
            name: project.name,
            identifier: project.identifier,
            ...(typeof task.project === "object" ? task.project : {})
          }
        };
      })
      .filter((task) => selectedStateNames.size === 0
        || selectedStateNames.has(String(task.state?.name || "").toLocaleLowerCase()));
  }));

  return projectTasks.flat();
}

module.exports = { buildTaskUrl, discoverWorkspace, fetchAssignedTasks, isUuid, normalizeBaseUrl };
