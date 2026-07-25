param(
  [string]$Version,
  [string]$ChangelogPath = (Join-Path $PSScriptRoot "..\CHANGELOG.md")
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
  $packagePath = Join-Path $PSScriptRoot "..\package.json"
  $Version = [string](Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json).version
}

$lines = Get-Content -LiteralPath $ChangelogPath -Encoding UTF8
$heading = "## [$Version]"
$start = -1
for ($index = 0; $index -lt $lines.Count; $index++) {
  if ($lines[$index].StartsWith($heading, [System.StringComparison]::Ordinal)) {
    $start = $index + 1
    break
  }
}
if ($start -lt 0) {
  throw "CHANGELOG.md has no entry for $Version."
}

$end = $lines.Count
for ($index = $start; $index -lt $lines.Count; $index++) {
  if ($lines[$index].StartsWith("## [", [System.StringComparison]::Ordinal)) {
    $end = $index
    break
  }
}

$notes = ($lines[$start..($end - 1)] -join [Environment]::NewLine).Trim()
if (-not $notes -or $notes -notmatch '(?m)^- ') {
  throw "The $Version changelog entry has no release notes."
}

Write-Output $notes

