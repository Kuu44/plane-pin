"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { layoutTasks, orderItems } = require("../src/renderer/task-layout");

const tasks = [
  {
    id: "shared",
    name: "Shared task",
    stateName: "In Progress",
    projectId: "project-b",
    projectName: "Beta",
    assignees: [{ id: "member-b", name: "Bea" }, { id: "member-a", name: "Ari" }]
  },
  {
    id: "done",
    name: "Finished task",
    stateName: "Done",
    projectId: "project-a",
    projectName: "Alpha",
    assignees: [{ id: "member-a", name: "Ari" }]
  },
  {
    id: "todo",
    name: "Queued task",
    stateName: "Todo",
    projectId: "project-a",
    projectName: "Alpha",
    assignees: [{ id: "member-a", name: "Ari" }]
  }
];

test("member grouping renders shared tasks once and nests projects only when enabled", () => {
  const flat = layoutTasks(tasks, {
    groupByMember: true,
    groupByProject: false,
    memberOrder: ["member-a", "member-b"],
    assigneeIds: ["member-a"],
    stateOrder: ["Todo", "In Progress", "Done"]
  });
  assert.deepEqual(flat.filter((row) => row.type === "member").map((row) => row.name), ["Ari"]);
  assert.equal(flat.filter((row) => row.type === "project").length, 0);
  assert.equal(flat.filter((row) => row.type === "task" && row.task.id === "shared").length, 1);

  const nested = layoutTasks(tasks, {
    groupByMember: true,
    groupByProject: true,
    memberOrder: ["member-b", "member-a"],
    assigneeIds: ["member-b", "member-a"],
    projectOrder: ["project-b", "project-a"],
    stateOrder: ["Todo", "In Progress", "Done"]
  });
  assert.deepEqual(nested.filter((row) => row.type === "member").map((row) => row.name), ["Bea", "Ari"]);
  assert.deepEqual(nested.filter((row) => row.type === "project").map((row) => row.name), ["Beta", "Alpha"]);
  assert.equal(nested.filter((row) => row.type === "task" && row.task.id === "shared").length, 1);
});

test("project and workflow orders drive the ungrouped-member task rail", () => {
  const rows = layoutTasks(tasks, {
    groupByMember: false,
    groupByProject: true,
    projectOrder: ["project-a", "project-b"],
    stateOrder: ["Todo", "In Progress", "Done"]
  });

  assert.deepEqual(rows.map((row) => row.type === "task" ? row.task.id : row.name), [
    "Alpha",
    "todo",
    "done",
    "Beta",
    "shared"
  ]);
});

test("saved orders keep unknown new options at the end", () => {
  assert.deepEqual(
    orderItems([{ id: "a" }, { id: "b" }, { id: "c" }], ["b", "a"], (item) => item.id),
    [{ id: "b" }, { id: "a" }, { id: "c" }]
  );
});
