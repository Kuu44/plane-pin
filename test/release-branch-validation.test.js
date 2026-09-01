"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "merge-release.ps1");

test("accepts prefixed and historical release branches while rejecting malformed names", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const patternMatch = script.match(/\[ValidatePattern\('([^']+)'\)\]/);
  assert.ok(patternMatch, "merge-release.ps1 must declare a ValidatePattern validator");

  const branchPattern = new RegExp(patternMatch[1]);
  const acceptedBranches = [
    "kuu/feature/login-startup-onboarding-v0.16.0",
    "kuu/fix/release-gate",
    "feature/historical-release",
    "fix/legacy-release"
  ];
  const rejectedBranches = [
    "kuu/chore/release",
    "kuu/feature/",
    "feature/",
    "fix/-legacy",
    "feature/invalid name"
  ];

  for (const branch of acceptedBranches) {
    assert.equal(branchPattern.test(branch), true, `expected branch to match: ${branch}`);
  }
  for (const branch of rejectedBranches) {
    assert.equal(branchPattern.test(branch), false, `expected branch to be rejected: ${branch}`);
  }
});
