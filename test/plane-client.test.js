"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTaskUrl, discoverWorkspace, fetchAssignedTasks, normalizeBaseUrl } = require("../src/plane-client");

const projectA = { id: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "MKTG", name: "Marketing" };
const projectB = { id: "10918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "ENG", name: "Engineering" };

test("loads exact selected state names for one assignee across all projects", async () => {
  const requestedUrls = [];
  const request = async (url) => {
    requestedUrls.push(url);
    if (url.pathname.endsWith("/projects/")) {
      return { ok: true, json: async () => [projectA, projectB] };
    }
    if (url.pathname.endsWith("/states/")) {
      return {
        ok: true,
        json: async () => [
          { id: "state-active", name: "In Progress", group: "started" },
          { id: "state-review", name: "In Review", group: "started" }
        ]
      };
    }
    return { ok: true, json: async () => [
      { id: `${requestedUrls.length}-active`, state: "state-active" },
      { id: `${requestedUrls.length}-review`, state: "state-review" }
    ] };
  };

  const tasks = await fetchAssignedTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectScope: "all",
    projectId: "",
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    stateFilterMode: "selected",
    stateNames: ["In Progress"],
    apiToken: "secret"
  }, request);

  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks.map((task) => task.project.identifier).sort(), ["ENG", "MKTG"]);
  assert.ok(requestedUrls.slice(1).every((url) =>
    !url.pathname.endsWith("/work-items/")
    || url.searchParams.get("assignee") === "94cf0210-9909-4f77-b24e-14b2988156e5"));
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
    stateFilterMode: "all",
    stateNames: [],
    apiToken: "secret"
  }, request);

  assert.equal(requestedPaths.filter((path) => path.includes("/work-items/")).length, 1);
  assert.match(requestedPaths[1], new RegExp(projectA.id));
});

test("discovers the current user, projects, and their exact states", async () => {
  const request = async (url) => {
    if (url.pathname.endsWith("/projects/")) {
      return { ok: true, json: async () => [projectA] };
    }
    if (url.pathname.endsWith("/users/me/")) {
      return {
        ok: true,
        json: async () => ({
          id: "94cf0210-9909-4f77-b24e-14b2988156e5",
          display_name: "Kuu"
        })
      };
    }
    return {
      ok: true,
      json: async () => [{ id: "state-active", name: "Working on", group: "started", color: "#5b43d6" }]
    };
  };

  const result = await discoverWorkspace({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    apiToken: "secret"
  }, request);

  assert.equal(result.member.name, "Kuu");
  assert.equal(result.projects[0].states[0].name, "Working on");
});

test("rejects insecure remote Plane URLs", () => {
  assert.throws(() => normalizeBaseUrl("http://plane.example.com"), /must use HTTPS/);
  assert.equal(normalizeBaseUrl("http://localhost:3000/path"), "http://localhost:3000");
});

test("builds the browser URL used by Plane work items", () => {
  assert.equal(
    buildTaskUrl("https://plane.example.com", "engineering", {
      sequence_id: 17,
      project: { identifier: "MKTG" }
    }),
    "https://plane.example.com/engineering/browse/MKTG-17/"
  );
});
