"use strict";

const validProjectScopes = new Set(["all", "single"]);
const validFilterModes = new Set(["all", "selected"]);

function cleanStateNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((name) => String(name).trim()).filter(Boolean))].slice(0, 100);
}

function normalizeStoredSettings(stored = {}) {
  const legacyConnection = Boolean(stored.baseUrl && stored.workspaceSlug && stored.memberId && stored.apiToken);
  return {
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
    setupComplete: stored.setupComplete === true || (stored.setupComplete === undefined && legacyConnection)
  };
}

function loadStoredSettings(stored, decryptToken) {
  let token = "";
  let tokenError = false;
  if (stored?.apiToken) {
    try {
      token = decryptToken(stored.apiToken);
    } catch {
      tokenError = true;
    }
  }
  return {
    settings: normalizeStoredSettings(stored),
    token,
    tokenError,
    encryptedTokenPresent: Boolean(stored?.apiToken)
  };
}

module.exports = { cleanStateNames, loadStoredSettings, normalizeStoredSettings };

