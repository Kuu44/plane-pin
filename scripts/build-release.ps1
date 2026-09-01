$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$package = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "package.json version must use X.Y.Z."
}

if (git status --porcelain) {
  throw "Commit the source changes before creating release files."
}

npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

npm.cmd run dist:win
if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed." }

$buildsDir = Join-Path $repoRoot "builds"
New-Item -ItemType Directory -Path $buildsDir -Force | Out-Null
Get-ChildItem -LiteralPath $buildsDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^Plane-Pin-(Setup|Source)-v.+\.(exe|zip)$' -or $_.Name -match '^Plane-Pin-Setup-v.+\.exe\.blockmap$' -or $_.Name -eq 'latest.yml' } |
  Remove-Item -Force

$installerName = "Plane-Pin-Setup-v$version.exe"
$installer = Join-Path $repoRoot "dist\$installerName"
if (-not (Test-Path -LiteralPath $installer)) {
  throw "Expected installer was not created: $installer"
}

Copy-Item -LiteralPath $installer -Destination (Join-Path $buildsDir $installerName)

$blockmap = "$installer.blockmap"
if (Test-Path -LiteralPath $blockmap) {
  Copy-Item -LiteralPath $blockmap -Destination (Join-Path $buildsDir "$installerName.blockmap")
}

$latest = Join-Path $repoRoot "dist\latest.yml"
if (Test-Path -LiteralPath $latest) {
  Copy-Item -LiteralPath $latest -Destination (Join-Path $buildsDir "latest.yml")
}

$sourceArchive = Join-Path $buildsDir "Plane-Pin-Source-v$version.zip"
git archive --format=zip --output=$sourceArchive HEAD
if ($LASTEXITCODE -ne 0) { throw "Source archive creation failed." }

Get-ChildItem -LiteralPath $buildsDir -File |
  Sort-Object Name |
  ForEach-Object {
    $stream = $null
    $algorithm = $null
    try {
      $stream = [System.IO.File]::OpenRead($_.FullName)
      $algorithm = [System.Security.Cryptography.SHA256]::Create()
      $hashBytes = $algorithm.ComputeHash($stream)
      $hash = [System.BitConverter]::ToString($hashBytes).Replace('-', '').ToUpperInvariant()
    }
    finally {
      if ($stream -ne $null) { $stream.Dispose() }
      if ($algorithm -ne $null) { $algorithm.Dispose() }
    }
    Write-Output "$($_.Name)  SHA256 $hash"
  }

