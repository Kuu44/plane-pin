"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "build-release.ps1");

test("uses the portable streaming SHA-256 release hash path", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.doesNotMatch(script, /\bGet-FileHash\b/);
  assert.match(script, /\[System\.IO\.File\]::OpenRead\(\$\_\.FullName\)/);
  assert.match(script, /\[System\.Security\.Cryptography\.SHA256\]::Create\(\)/);
  assert.match(script, /\$algorithm\.ComputeHash\(\$stream\)/);
  assert.match(script, /\.ToUpperInvariant\(\)/);
  assert.match(script, /Write-Output "\$\(\$\_\.Name\)  SHA256 \$hash"/);
});
