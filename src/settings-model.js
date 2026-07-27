"use strict";

const validRefreshMinutes = new Set([0, 1, 5, 10, 15, 30]);
const validThemes = new Set(["light", "dark"]);
const validPriorityStyles = new Set(["dot", "gradient"]);
const { cleanStateMappings } = require("./renderer/completion-model");

function cleanStrings(value, limit = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);
}

const cleanIds = (value) => cleanStrings(value, 500);
const cleanStateNames = (value) => cleanStrings(value, 100);
const cleanOrder = (value) => cleanStrings(value, 500);

function normalizeStoredSettings(stored = {}) {
  const legacyConnection = Boolean(stored.baseUrl && stored.workspaceSlug && stored.memberId && stored.apiToken);
  const isCurrentSchema = Number(stored.schemaVersion) >= 2;
  const projectIds = isCurrentSchema
    ? (Array.isArray(stored.projectIds) ? cleanIds(stored.projectIds) : null)
    : stored.projectScope === "single" && stored.projectId
      ? cleanIds([stored.projectId])
      : null;
  const stateNames = isCurrentSchema
    ? (Array.isArray(stored.stateNames) ? cleanStateNames(stored.stateNames) : null)
    : stored.stateFilterMode === "selected"
      ? cleanStateNames(stored.stateNames)
      : null;
  return {
    schemaVersion: 4,
    baseUrl: String(stored.baseUrl || ""),
    workspaceSlug: String(stored.workspaceSlug || ""),
    memberId: String(stored.memberId || ""),
    memberName: String(stored.memberName || ""),
    assigneeIds: Array.isArray(stored.assigneeIds)
      ? cleanIds(stored.assigneeIds)
      : cleanIds([stored.memberId]),
    projectIds,
    stateNames,
    memberOrder: cleanOrder(stored.memberOrder),
    projectOrder: cleanOrder(stored.projectOrder),
    stateOrder: cleanOrder(stored.stateOrder),
    collapsedGroupKeys: cleanOrder(stored.collapsedGroupKeys),
    groupByProject: stored.groupByProject !== false,
    groupByMember: stored.groupByMember === true,
    changeOnCheck: stored.changeOnCheck === true,
    checkStateMappings: cleanStateMappings(stored.checkStateMappings),
    checkTargetStateName: String(stored.checkTargetStateName || "").trim().slice(0, 100),
    completionSound: stored.completionSound !== false,
    alwaysOnTop: stored.alwaysOnTop !== false,
    refreshMinutes: validRefreshMinutes.has(Number(stored.refreshMinutes)) ? Number(stored.refreshMinutes) : 5,
    theme: validThemes.has(stored.theme) ? stored.theme : "light",
    compactCards: stored.compactCards === true,
    priorityStyle: validPriorityStyles.has(stored.priorityStyle) ? stored.priorityStyle : "dot",
    closeToTray: stored.closeToTray !== false,
    minimizeToTray: stored.minimizeToTray !== false,
    startAtLogin: stored.startAtLogin === true,
    setupComplete: stored.setupComplete === true || (stored.setupComplete === undefined && legacyConnection)
  };
}

async function loadEncryptedSetting(candidates, key, decryptToken) {
  let value = "";
  let sourceIndex = candidates.findIndex((candidate) => Boolean(candidate[key]));
  let encryptedValue = sourceIndex >= 0 ? candidates[sourceIndex][key] : "";
  let temporarilyUnavailable = false;
  const encryptedValuePresent = candidates.some((candidate) => Boolean(candidate[key]));

  for (let index = 0; index < candidates.length; index += 1) {
    if (!candidates[index][key]) continue;
    try {
      value = await decryptToken(candidates[index][key]);
      encryptedValue = candidates[index][key];
      sourceIndex = index;
      break;
    } catch (error) {
      temporarilyUnavailable ||= /temporarily unavailable/i.test(String(error?.message || error));
      // Try a valid backup or a legacy userData directory.
    }
  }

  return {
    value,
    error: encryptedValuePresent && !value && !temporarilyUnavailable,
    temporarilyUnavailable: encryptedValuePresent && !value && temporarilyUnavailable,
    encryptedValuePresent,
    encryptedValue,
    sourceIndex
  };
}

async function loadStoredSettings(storedCandidates, decryptToken) {
  const candidates = (Array.isArray(storedCandidates) ? storedCandidates : [storedCandidates]).filter(Boolean);
  const stored = candidates[0] || {};
  const plane = await loadEncryptedSetting(candidates, "apiToken", decryptToken);

  return {
    settings: normalizeStoredSettings(stored),
    token: plane.value,
    tokenError: plane.error,
    tokenUnavailable: plane.temporarilyUnavailable,
    encryptedTokenPresent: plane.encryptedValuePresent,
    encryptedToken: plane.encryptedValue,
    tokenSourceIndex: plane.sourceIndex
  };
}

module.exports = { cleanIds, cleanOrder, cleanStateNames, loadStoredSettings, normalizeStoredSettings };

