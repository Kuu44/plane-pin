"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTaskUrl, discoverWorkspace, fetchAssignedTasks, normalizeBaseUrl, updateTaskState } = require("../src/plane-client");

const projectA = { id: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "MKTG", name: "Marketing" };
const projectB = { id: "10918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "ENG", name: "Engineering" };

test("filters exact states and selected members locally across all projects", async () => {
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
      { id: `${requestedUrls.length}-active`, state: "state-active", assignees: [{ id: "member-a" }] },
      { id: `${requestedUrls.length}-review`, state: "state-review", assignees: [{ id: "member-b" }] },
      { id: `${requestedUrls.length}-other`, state: "state-active", assignees: [{ id: "member-c" }] }
    ] };
  };

  const tasks = await fetchAssignedTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectIds: null,
    assigneeIds: ["member-a", "member-b"],
    stateNames: ["In Progress"],
    apiToken: "secret"
  }, request);

  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks.map((task) => task.project.identifier).sort(), ["ENG", "MKTG"]);
  assert.ok(requestedUrls.slice(1).every((url) =>
    !url.pathname.endsWith("/work-items/")
    || (!url.searchParams.has("assignee") && url.searchParams.get("expand") === "assignees,state,project")));
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
    projectIds: ["MKTG"],
    assigneeIds: ["94cf0210-9909-4f77-b24e-14b2988156e5"],
    stateNames: null,
    apiToken: "secret"
  }, request);

  assert.equal(requestedPaths.filter((path) => path.includes("/work-items/")).length, 1);
  assert.match(requestedPaths[1], new RegExp(projectA.id));
});

test("resolves configured estimate labels and preserves legacy numeric estimates", async () => {
  const estimateId = "20918ea1-52f7-48bd-abe3-d3efe76ff7dd";
  const estimatePointId = "30918ea1-52f7-48bd-abe3-d3efe76ff7dd";
  const request = async (url) => {
    if (url.pathname.endsWith("/projects/")) {
      return { ok: true, json: async () => [projectA] };
    }
    if (url.pathname.endsWith("/states/")) {
      return { ok: true, json: async () => [{ id: "state-active", name: "In Progress", group: "started" }] };
    }
    if (url.pathname.endsWith("/estimates/")) {
      return { ok: true, json: async () => ({ id: estimateId }) };
    }
    if (url.pathname.endsWith("/estimate-points/")) {
      return { ok: true, json: async () => [{ id: estimatePointId, key: 2, value: "M" }] };
    }
    return {
      ok: true,
      json: async () => [
        { id: "labelled", state: "state-active", assignees: [{ id: "member-a" }], estimate_point: estimatePointId },
        { id: "keyed", state: "state-active", assignees: [{ id: "member-a" }], estimate_point: 2 },
        { id: "legacy", state: "state-active", assignees: [{ id: "member-a" }], estimate_point: 3 },
        { id: "unknown", state: "state-active", assignees: [{ id: "member-a" }], estimate_point: "40918ea1-52f7-48bd-abe3-d3efe76ff7dd" }
      ]
    };
  };

  const tasks = await fetchAssignedTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectIds: null,
    assigneeIds: ["member-a"],
    stateNames: null,
    apiToken: "secret"
  }, request);

  assert.deepEqual(tasks.map((task) => task.estimateLabel), ["M", "M", "3", ""]);
});

test("skips projects Plane explicitly marks inaccessible", async () => {
  const requestedPaths = [];
  const request = async (url) => {
    requestedPaths.push(url.pathname);
    if (url.pathname.endsWith("/projects/")) {
      return {
        ok: true,
        json: async () => [
          projectA,
          { ...projectB, is_member: false }
        ]
      };
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
    if (url.pathname.endsWith("/members/")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => [] };
  };

  const config = {
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectIds: null,
    memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
    assigneeIds: ["94cf0210-9909-4f77-b24e-14b2988156e5"],
    stateNames: null,
    apiToken: "secret"
  };

  const discovery = await discoverWorkspace(config, request);
  await fetchAssignedTasks(config, request);

  assert.deepEqual(discovery.projects.map((project) => project.identifier), ["MKTG"]);
  assert.equal(requestedPaths.filter((path) => path.includes(projectB.id)).length, 0);
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
    if (url.pathname.endsWith("/members/")) {
      return {
        ok: true,
        json: async () => [{
          member: {
            id: "94cf0210-9909-4f77-b24e-14b2988156e5",
            display_name: "Kuu",
            email: "kuu@example.com"
          }
        }]
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
  assert.deepEqual(result.members[0], {
    id: "94cf0210-9909-4f77-b24e-14b2988156e5",
    name: "Kuu",
    email: "kuu@example.com"
  });
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

test("changes a work item using the target project's matching state UUID", async () => {
  const taskId = "40918ea1-52f7-48bd-abe3-d3efe76ff7dd";
  let patch;
  const request = async (url, options = {}) => {
    if (url.pathname.endsWith("/states/")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "50918ea1-52f7-48bd-abe3-d3efe76ff7dd",
            name: "Done",
            group: "completed",
            color: "#46a758"
          }
        ]
      };
    }
    patch = { url, options };
    return { ok: true, json: async () => ({}) };
  };

  const result = await updateTaskState({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectId: projectA.id,
    taskId,
    stateName: "Done",
    apiToken: "secret"
  }, request);

  assert.equal(patch.options.method, "PATCH");
  assert.deepEqual(JSON.parse(patch.options.body), {
    state: "50918ea1-52f7-48bd-abe3-d3efe76ff7dd"
  });
  assert.match(patch.url.pathname, new RegExp(`${projectA.id}/work-items/${taskId}/$`));
  assert.equal(result.stateGroup, "completed");
  assert.equal(result.stateColor, "#46a758");
});
