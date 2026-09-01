param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^(kuu/)?(feature|fix)/[a-z0-9][a-z0-9._-]*$')]
  [string]$Branch
)

$ErrorActionPreference = "Stop"

if ((git branch --show-current).Trim() -ne "master") {
  throw "Run this command from the master worktree."
}
if (git status --porcelain) {
  throw "The master worktree must be clean."
}

$packageJson = git show "${Branch}:package.json"
if ($LASTEXITCODE -ne 0) { throw "Cannot read package.json from $Branch." }
$version = [string]($packageJson | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "The branch package version must use X.Y.Z."
}

$tag = "v$version"
git rev-parse --verify --quiet "refs/tags/$tag" | Out-Null
if ($LASTEXITCODE -eq 0) { throw "Tag $tag already exists." }

$requiredFiles = @(
  "builds/Plane-Pin-Setup-v$version.exe",
  "builds/Plane-Pin-Source-v$version.zip",
  "CHANGELOG.md"
)
foreach ($file in $requiredFiles) {
  git cat-file -e "${Branch}:$file"
  if ($LASTEXITCODE -ne 0) { throw "$Branch is missing $file." }
}

$temporaryChangelog = [System.IO.Path]::GetTempFileName()
$temporaryMessage = [System.IO.Path]::GetTempFileName()
try {
  $previousOutputEncoding = [Console]::OutputEncoding
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $changelog = git show "${Branch}:CHANGELOG.md"
  if ($LASTEXITCODE -ne 0) { throw "Cannot read CHANGELOG.md from $Branch." }
  [System.IO.File]::WriteAllText(
    $temporaryChangelog,
    ($changelog -join [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
  )
  $notes = & (Join-Path $PSScriptRoot "get-release-notes.ps1") -Version $version -ChangelogPath $temporaryChangelog
  $message = @($tag, "", ($notes -join [Environment]::NewLine)) -join [Environment]::NewLine
  [System.IO.File]::WriteAllText($temporaryMessage, $message, [System.Text.UTF8Encoding]::new($false))

  git merge --no-ff --no-commit $Branch
  if ($LASTEXITCODE -ne 0) { throw "Merge failed. Resolve or abort it before continuing." }
  git commit -F $temporaryMessage
  if ($LASTEXITCODE -ne 0) { throw "Merge commit failed." }
  git tag -a $tag -m $tag
  if ($LASTEXITCODE -ne 0) { throw "Tag creation failed." }
} finally {
  if ($previousOutputEncoding) { [Console]::OutputEncoding = $previousOutputEncoding }
  Remove-Item -LiteralPath $temporaryChangelog, $temporaryMessage -Force -ErrorAction SilentlyContinue
}

Write-Output "Created $tag. Review it, then push master and $tag."

