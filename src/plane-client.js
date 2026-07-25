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
    throw new Error("Plane returned an unexpected work-item response.");
  }
  return {
    results: payload.results,
    nextCursor: payload.next_page_results ? payload.next_cursor : null
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveProjectId(baseUrl, workspace, projectRef, apiToken, request) {
  if (isUuid(projectRef)) return projectRef;

  const url = new URL(`/api/v1/workspaces/${workspace}/projects/`, baseUrl);
  url.searchParams.set("per_page", "100");
  const response = await request(url, {
    headers: { Accept: "application/json", "X-API-Key": apiToken }
  });
  if (!response.ok) throw new Error(`Could not look up project ${projectRef}. Plane returned HTTP ${response.status}.`);

  const projects = asPage(await response.json()).results;
  const project = projects.find((item) => String(item.identifier).toLowerCase() === projectRef.toLowerCase());
  if (!project?.id) throw new Error(`No Plane project uses the key "${projectRef}".`);
  return project.id;
}

async function fetchInProgressTasks(config, request = fetch) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const workspace = encodeURIComponent(config.workspaceSlug);
  const project = encodeURIComponent(await resolveProjectId(
    baseUrl,
    workspace,
    config.projectId,
    config.apiToken,
    request
  ));
  const tasks = [];
  let cursor = null;

  for (let pageNumber = 0; pageNumber < 50; pageNumber += 1) {
    const url = new URL(`/api/v1/workspaces/${workspace}/projects/${project}/work-items/`, baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("expand", "state,project");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await request(url, {
      headers: {
        Accept: "application/json",
        "X-API-Key": config.apiToken
      }
    });

    if (!response.ok) {
      const detail = response.status === 401 || response.status === 403
        ? "Check the API token and its workspace access."
        : `Plane returned HTTP ${response.status}.`;
      throw new Error(detail);
    }

    const page = asPage(await response.json());
    tasks.push(...page.results.filter((item) => item.state?.group === "started"));
    if (!page.nextCursor) return tasks;
    cursor = page.nextCursor;
  }

  throw new Error("Plane returned more pages than the app can safely load.");
}

module.exports = { fetchInProgressTasks, normalizeBaseUrl };
