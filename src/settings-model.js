"use strict";

const validProjectScopes = new Set(["all", "single"]);
const validFilterModes = new Set(["all", "selected"]);
const validRefreshMinutes = new Set([0, 1, 5, 10, 15, 30]);
const validThemes = new Set(["light", "dark"]);

function cleanStateNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((name) => String(name).trim()).filter(Boolean))].slice(0, 100);
}

function normalizeStoredSettings(stored = {}) {
  const legacyConnection = Boolean(stored.baseUrl && stored.workspaceSlug && stored.memberId && stored.apiToken);
  return {
    schemaVersion: 1,
    baseUrl: String(stored.baseUrl || ""),
    workspaceSlug: String(stored.workspaceSlug || ""),
    projectId: String(stored.projectId || ""),
    projectScope: validProjectScopes.has(stored.projectScope) ? stored.projectScope : "all",
    memberId: String(stored.memberId || ""),
    memberName: String(stored.memberName || ""),
    stateFilterMode: validFilterModes.has(stored.stateFilterMode) ? stored.stateFilterMode : "all",
    stateNames: cleanStateNames(stored.stateNames),
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

module.exports = { cleanStateNames, loadStoredSettings, normalizeStoredSettings };

