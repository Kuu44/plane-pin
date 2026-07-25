"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchAssignedTasks, normalizeBaseUrl } = require("../src/plane-client");

const projectA = { id: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "MKTG", name: "Marketing" };
const projectB = { id: "10918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "ENG", name: "Engineering" };

test("loads the selected status for one assignee across all projects", async () => {
  const requestedUrls = [];
  const request = async (url) => {
    requestedUrls.push(url);
    if (url.pathname.endsWith("/projects/")) {
      return { ok: true, json: async () => [projectA, projectB] };
    }
    return {
      ok: true,
      json: async () => [
        { id: `${requestedUrls.length}-active`, state: { group: "started" } },
        { id: `${requestedUrls.length}-queued`, state: { group: "unstarted" } }
      ]
    };
  };

  const tasks = await fetchAssignedTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectScope: "all",
    projectId: "",
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    statusGroup: "started",
    apiToken: "secret"
  }, request);

  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks.map((task) => task.project.identifier).sort(), ["ENG", "MKTG"]);
  assert.ok(requestedUrls.slice(1).every((url) =>
    url.searchParams.get("assignee") === "94cf0210-9909-4f77-b24e-14b2988156e5"));
});

test("limits requests when one project key is selected", async () => {
  const requestedPaths = [];
  const request = async (url) => {
    requestedPaths.push(url.pathname);
    return {
      ok: true,
      json: async () => url.pathname.endsWith("/projects/") ? [projectA, projectB] : []
    };
  };

  await fetchAssignedTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectScope: "single",
    projectId: "MKTG",
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    statusGroup: "started",
    apiToken: "secret"
  }, request);

  assert.equal(requestedPaths.filter((path) => path.includes("/work-items/")).length, 1);
  assert.match(requestedPaths[1], new RegExp(projectA.id));
});

test("rejects insecure remote Plane URLs", () => {
  assert.throws(() => normalizeBaseUrl("http://plane.example.com"), /must use HTTPS/);
  assert.equal(normalizeBaseUrl("http://localhost:3000/path"), "http://localhost:3000");
});
