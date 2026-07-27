# Plane Pin repository rules

These rules apply from `v0.3.0` onward.

## Branches and versions

- `master` contains only tested, installable releases.
- Never commit feature or fix work directly to `master`.
- Start every change on its own branch, normally `feature/<name>` or `fix/<name>`.
- Finish and verify the branch before merging it.
- Merge into `master` with a merge commit named exactly like the release, for example `v0.3.0`, and tag that commit with the same version.
- Use semantic versions: bug fix = patch, backward-compatible feature = minor, breaking change = major.
- Keep `CHANGELOG.md` in Keep a Changelog format. Every release needs a dated version entry with user-facing notes.
- Use Conventional Commit subjects on feature branches, such as `feat:`, `fix:`, `docs:`, or `build:`.
- Copy the current changelog entry into the PR's Release notes section without rewriting it.

## Required release checks

Before a version can reach `master`:

1. Set the same version in `package.json` and `package-lock.json`.
2. Run `npm.cmd test`.
3. Commit the source changes.
4. Run `npm.cmd run release:win`.
5. Do not install the candidate on Kuu's machine. Verify updater metadata statically, publish the release, and leave the installed version untouched for Kuu's in-app auto-update test.
6. Commit the generated `builds/` files.
7. From the clean `master` worktree, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/merge-release.ps1 -Branch <branch>`.
8. Confirm the merge commit subject is `vX.Y.Z`, its body matches that changelog entry, and the matching tag exists.

`builds/` contains only the final files for that branch's version. A release merge replaces the older files there, so `master` always carries the latest installer and source archive. Installers are stored with Git LFS.

`CHANGELOG.md` is the release-note source of truth. `scripts/get-release-notes.ps1` extracts the current version for PR descriptions, merge commits, and GitHub Releases.

## Stability and secrets

- Keep the Electron app ID `com.niyalo.planepin` unchanged; Windows uses it to recognize upgrades.
- Keep user settings under Electron's `userData` directory. Do not move or delete them during upgrades.
- Never commit Plane tokens, `.env` files, or other credentials.
- Plane tokens must remain in Electron's main process and use `safeStorage`.
- Automatic updates use the public GitHub release feed and must not require or store a GitHub token.

