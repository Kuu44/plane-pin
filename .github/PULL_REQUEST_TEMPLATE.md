## Summary

<!-- What changed and why? -->

## Release notes

<!--
Paste the exact current-version entry produced by:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/get-release-notes.ps1

Use "Not user-facing" only when this PR will not create a release.
-->

## Verification

- [ ] `npm.cmd test`
- [ ] `npm.cmd run release:win`
- [ ] The installer upgrades the previous version without losing settings
- [ ] `CHANGELOG.md` and the package version match

