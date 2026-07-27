"use strict";

// Shared by Electron's main process, the renderer, and node --test.
(function (root) {
  const key = (value) => String(value || "").trim().toLocaleLowerCase();

  function cleanStateMappings(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const mappings = [];
    for (const entry of value) {
      const source = String(entry?.source || "").trim().slice(0, 100);
      const target = String(entry?.target || "").trim().slice(0, 100);
      const sourceKey = key(source);
      if (!sourceKey || sourceKey === key(target) || seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      mappings.push({ source, target });
      if (mappings.length === 100) break;
    }
    return mappings;
  }

  function defaultStateMappings(states, order = []) {
    const positions = new Map(order.map((name, index) => [key(name), index]));
    const ordered = states.map((state, index) => ({ state, index })).sort((left, right) => {
      const leftPosition = positions.get(key(left.state.name)) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = positions.get(key(right.state.name)) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || left.index - right.index;
    }).map(({ state }) => state);
    return ordered.map((state, index) => ({
      source: String(state.name),
      target: String(ordered[index + 1]?.name || "")
    }));
  }

  function targetForState(mappings, stateName, legacyTarget = "") {
    const sourceKey = key(stateName);
    const mapping = cleanStateMappings(mappings).find((entry) => key(entry.source) === sourceKey);
    return mapping ? mapping.target : String(legacyTarget || "").trim();
  }

  function shouldCelebrateTransition(result) {
    return key(result?.stateName).replace(/\s+/g, "") === "inreview"
      || key(result?.stateName) === "done"
      || key(result?.stateGroup) === "completed";
  }

  const api = { cleanStateMappings, defaultStateMappings, shouldCelebrateTransition, targetForState };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.planePinCompletion = api;
})(typeof window !== "undefined" ? window : null);
