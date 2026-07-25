# Plane Pin repository rules

These rules apply from `v0.3.0` onward.

## Branches and versions

- `master` contains only tested, installable releases.
- Never commit feature or fix work directly to `master`.
- Start every change on its own branch, normally `feature/<name>` or `fix/<name>`.
- Finish and verify the branch before merging it.
- Merge into `master` with a merge commit named exactly like the release, for example `v0.3.0`, and tag that commit with the same version.
- Use semantic versions: bug fix = patch, backward-compatible feature = minor, breaking change = major.

## Required release checks

Before a version can reach `master`:

1. Set the same version in `package.json` and `package-lock.json`.
2. Run `npm.cmd test`.
3. Commit the source changes.
4. Run `npm.cmd run release:win`.
5. Verify the installer upgrades the previous installed version without losing settings.
6. Commit the generated `builds/` files.
7. Merge with `git merge --no-ff <branch> -m "vX.Y.Z"` and tag the merge commit.

`builds/` contains only the final files for that branch's version. A release merge replaces the older files there, so `master` always carries the latest installer and source archive. Installers are stored with Git LFS.

## Stability and secrets

- Keep the Electron app ID `com.niyalo.planepin` unchanged; Windows uses it to recognize upgrades.
- Keep user settings under Electron's `userData` directory. Do not move or delete them during upgrades.
- Never commit Plane tokens, GitHub tokens, `.env` files, or other credentials.
- Plane tokens must remain in Electron's main process and use `safeStorage`.
- Automatic updates for the private GitHub repository require a user-supplied `GH_TOKEN`. Never embed that token in the app.

