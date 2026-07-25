"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchInProgressTasks, normalizeBaseUrl } = require("../src/plane-client");

test("keeps only tasks in Plane's started state group", async () => {
  const request = async () => ({
    ok: true,
    json: async () => ({
      next_page_results: false,
      results: [
        { id: "1", name: "Active", state: { group: "started" } },
        { id: "2", name: "Queued", state: { group: "unstarted" } }
      ]
    })
  });

  const tasks = await fetchInProgressTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "team",
    projectId: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd",
    apiToken: "secret"
  }, request);

  assert.deepEqual(tasks.map((task) => task.id), ["1"]);
});

test("resolves a project key before loading work items", async () => {
  const urls = [];
  const request = async (url) => {
    urls.push(url.pathname);
    return {
      ok: true,
      json: async () => urls.length === 1
        ? [{ id: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd", identifier: "MKTG" }]
        : []
    };
  };

  await fetchInProgressTasks({
    baseUrl: "https://plane.example.com",
    workspaceSlug: "engineering",
    projectId: "MKTG",
    apiToken: "secret"
  }, request);

  assert.match(urls[1], /00918ea1-52f7-48bd-abe3-d3efe76ff7dd/);
});

test("rejects insecure remote Plane URLs", () => {
  assert.throws(() => normalizeBaseUrl("http://plane.example.com"), /must use HTTPS/);
  assert.equal(normalizeBaseUrl("http://localhost:3000/path"), "http://localhost:3000");
});
