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

async function fetchAssignedTasks(config, request = fetch) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const workspace = encodeURIComponent(config.workspaceSlug);
  const projectsUrl = new URL(`/api/v1/workspaces/${workspace}/projects/`, baseUrl);
  projectsUrl.searchParams.set("per_page", "100");
  const projects = await fetchPages(projectsUrl, config.apiToken, request);
  const selectedProjects = config.projectScope === "single"
    ? projects.filter((project) => project.id === config.projectId
      || String(project.identifier).toLowerCase() === config.projectId.toLowerCase())
    : projects;

  if (config.projectScope === "single" && selectedProjects.length === 0) {
    throw new Error(`No Plane project uses the ID or key "${config.projectId}".`);
  }

  const projectTasks = await Promise.all(selectedProjects.map(async (project) => {
    const url = new URL(`/api/v1/workspaces/${workspace}/projects/${encodeURIComponent(project.id)}/work-items/`, baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("expand", "state,project");
    url.searchParams.set("assignee", config.memberId);
    const tasks = await fetchPages(url, config.apiToken, request);
    return tasks
      .filter((task) => task.state?.group === config.statusGroup)
      .map((task) => ({
        ...task,
        project: {
          id: project.id,
          name: project.name,
          identifier: project.identifier,
          ...(typeof task.project === "object" ? task.project : {})
        }
      }));
  }));

  return projectTasks.flat();
}

module.exports = { fetchAssignedTasks, isUuid, normalizeBaseUrl };
