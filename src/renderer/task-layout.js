"use strict";

// Shared by the renderer and node --test.
(function (root) {
  const key = (value) => String(value || "").toLocaleLowerCase();

  function indexFor(order, value) {
    const index = (order || []).map(key).indexOf(key(value));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }

  function orderItems(items, order, valueFor) {
    const positions = new Map((order || []).map((value, index) => [key(value), index]));
    return items.map((item, index) => ({ item, index })).sort((left, right) => {
      const leftPosition = positions.get(key(valueFor(left.item))) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = positions.get(key(valueFor(right.item))) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || left.index - right.index;
    }).map(({ item }) => item);
  }

  function sortTasks(tasks, stateOrder) {
    return tasks.map((task, index) => ({ task, index })).sort((left, right) => {
      const stateDifference = indexFor(stateOrder, left.task.stateName) - indexFor(stateOrder, right.task.stateName);
      if (stateDifference) return stateDifference;
      const nameDifference = String(left.task.name || "").localeCompare(String(right.task.name || ""));
      return nameDifference || left.index - right.index;
    }).map(({ task }) => task);
  }

  function group(items, getKey, getName, order) {
    const groups = new Map();
    for (const item of items) {
      const id = String(getKey(item) || "");
      if (!groups.has(id)) groups.set(id, { id, name: getName(item), tasks: [] });
      groups.get(id).tasks.push(item);
    }
    return [...groups.values()].sort((left, right) => {
      const orderDifference = indexFor(order, left.id) - indexFor(order, right.id);
      return orderDifference || left.name.localeCompare(right.name);
    });
  }

  function memberFor(task, memberOrder) {
    const assignees = Array.isArray(task.assignees) ? task.assignees : [];
    for (const memberId of memberOrder || []) {
      const match = assignees.find((assignee) => key(assignee.id) === key(memberId));
      if (match) return match;
    }
    return assignees[0] || { id: "", name: "Unassigned" };
  }

  function layoutTasks(tasks, options = {}) {
    const rows = [];
    const stateOrder = options.stateOrder || [];
    const appendProjects = (projectTasks, nested = false) => {
      for (const project of group(
        projectTasks,
        (task) => task.projectId || task.projectIdentifier || task.projectName,
        (task) => task.projectName || task.projectIdentifier || "Project",
        options.projectOrder
      )) {
        rows.push({ type: "project", name: project.name, count: project.tasks.length, nested });
        rows.push(...sortTasks(project.tasks, stateOrder).map((task) => ({ type: "task", task })));
      }
    };

    if (options.groupByMember) {
      const selectedMembers = options.assigneeIds?.length ? options.assigneeIds : options.memberOrder || [];
      const selectedKeys = new Set(selectedMembers.map(key));
      const orderedMembers = [
        ...(options.memberOrder || []).filter((id) => selectedKeys.has(key(id))),
        ...selectedMembers.filter((id) => !(options.memberOrder || []).some((ordered) => key(ordered) === key(id)))
      ];
      for (const member of group(
        tasks,
        (task) => memberFor(task, orderedMembers).id,
        (task) => memberFor(task, orderedMembers).name,
        orderedMembers
      )) {
        rows.push({ type: "member", name: member.name, count: member.tasks.length });
        if (options.groupByProject) appendProjects(member.tasks, true);
        else rows.push(...sortTasks(member.tasks, stateOrder).map((task) => ({ type: "task", task })));
      }
    } else if (options.groupByProject) {
      appendProjects(tasks);
    } else {
      rows.push(...sortTasks(tasks, stateOrder).map((task) => ({ type: "task", task })));
    }
    return rows;
  }

  const api = { layoutTasks, orderItems, sortTasks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.planePinTaskLayout = api;
})(typeof window !== "undefined" ? window : null);
