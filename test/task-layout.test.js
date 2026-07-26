"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  dropOrderedValue,
  filterTasks,
  layoutTasks,
  moveOrderedValue,
  orderItems
} = require("../src/renderer/task-layout");

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
  assert.deepEqual(nested.filter((row) => row.type === "member").map((row) => row.key), [
    "member:member-b",
    "member:member-a"
  ]);
  assert.deepEqual(nested.filter((row) => row.type === "project").map((row) => row.key), [
    "project:member-b:project-b",
    "project:member-a:project-a"
  ]);
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

test("unassigned project groups keep a stable nested collapse key", () => {
  const rows = layoutTasks([{
    id: "unassigned",
    name: "Unassigned task",
    projectId: "project-a",
    projectName: "Alpha",
    stateName: "Todo",
    assignees: []
  }], { groupByMember: true, groupByProject: true });
  assert.deepEqual(
    rows.filter((row) => row.type !== "task").map((row) => row.key),
    ["member:unassigned", "project:unassigned:project-a"]
  );
});

test("reorder placement follows the visible insertion boundary", () => {
  const values = ["Todo", "In Progress", "Done"];
  assert.deepEqual(
    dropOrderedValue(values, "Todo", "Done", "before"),
    ["In Progress", "Todo", "Done"]
  );
  assert.deepEqual(
    dropOrderedValue(values, "Todo", "Done", "after"),
    ["In Progress", "Done", "Todo"]
  );
  assert.deepEqual(moveOrderedValue(values, "In Progress", -1), ["In Progress", "Todo", "Done"]);
  assert.deepEqual(moveOrderedValue(values, "Todo", -1), values);
});

test("cached tasks can narrow immediately while a fresh Plane pull runs", () => {
  assert.deepEqual(
    filterTasks(tasks, {
      assigneeIds: ["member-a"],
      projectIds: ["project-a"],
      stateNames: ["Todo"]
    }).map((task) => task.id),
    ["todo"]
  );
  assert.deepEqual(filterTasks(tasks, { assigneeIds: [] }), []);
  assert.equal(filterTasks(tasks, { assigneeIds: null, projectIds: null, stateNames: null }).length, 3);
});
