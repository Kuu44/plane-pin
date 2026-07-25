"use strict";

const validRefreshMinutes = new Set([0, 1, 5, 10, 15, 30]);
const validThemes = new Set(["light", "dark"]);

function cleanStrings(value, limit = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);
}

const cleanIds = (value) => cleanStrings(value, 500);
const cleanStateNames = (value) => cleanStrings(value, 100);

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
    schemaVersion: 2,
    baseUrl: String(stored.baseUrl || ""),
    workspaceSlug: String(stored.workspaceSlug || ""),
    memberId: String(stored.memberId || ""),
    memberName: String(stored.memberName || ""),
    assigneeIds: Array.isArray(stored.assigneeIds)
      ? cleanIds(stored.assigneeIds)
      : cleanIds([stored.memberId]),
    projectIds,
    stateNames,
    groupByProject: stored.groupByProject !== false,
    alwaysOnTop: stored.alwaysOnTop !== false,
    refreshMinutes: validRefreshMinutes.has(Number(stored.refreshMinutes)) ? Number(stored.refreshMinutes) : 5,
    theme: validThemes.has(stored.theme) ? stored.theme : "light",
    compactCards: stored.compactCards === true,
    closeToTray: stored.closeToTray !== false,
    minimizeToTray: stored.minimizeToTray !== false,
    setupComplete: stored.setupComplete === true || (stored.setupComplete === undefined && legacyConnection)
  };
}

function loadStoredSettings(storedCandidates, decryptToken) {
  const candidates = (Array.isArray(storedCandidates) ? storedCandidates : [storedCandidates]).filter(Boolean);
  const stored = candidates[0] || {};
  let token = "";
  let encryptedToken = "";
  let tokenSourceIndex = -1;
  const encryptedTokenPresent = candidates.some((candidate) => Boolean(candidate.apiToken));

  for (let index = 0; index < candidates.length; index += 1) {
    if (!candidates[index].apiToken) continue;
    try {
      token = decryptToken(candidates[index].apiToken);
      encryptedToken = candidates[index].apiToken;
      tokenSourceIndex = index;
      break;
    } catch {
      // Try a valid backup or a legacy userData directory.
    }
  }

  return {
    settings: normalizeStoredSettings(stored),
    token,
    tokenError: encryptedTokenPresent && !token,
    encryptedTokenPresent,
    encryptedToken,
    tokenSourceIndex
  };
}

module.exports = { cleanIds, cleanStateNames, loadStoredSettings, normalizeStoredSettings };

