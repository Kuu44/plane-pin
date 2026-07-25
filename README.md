# Plane Pin

A compact Electron companion that keeps your assigned self-hosted Plane work visible above other windows.

## Run

```powershell
npm.cmd install
npm.cmd start
```

Open connection settings and enter:

- Plane base URL, such as `https://plane.example.com`
- workspace slug
- member UUID from your Plane profile URL
- all projects or one project UUID/readable key, such as `MKTG`
- a shared Plane status group
- Plane personal access token

The token is handled only by Electron's main process and persisted with Electron `safeStorage` when OS encryption is available.

For a task URL such as `https://plane.example.com/engineering/browse/MKTG-17/`, enter:

- Plane URL: `https://plane.example.com`
- workspace slug: `engineering`
- project key: `MKTG`

For a My Work URL such as `https://plane.example.com/engineering/profile/USER-UUID/assigned/`, use `USER-UUID` as the member ID. The list can combine every accessible project and optionally add project section headings.

## Check and package

```powershell
npm.cmd test
npm.cmd run release:win
```

Commit source changes before running the release command. It tests and packages the app, then replaces `builds/` with the current version's installer, source archive, and updater metadata.

## Windows upgrades and settings

Running a newer Plane Pin installer upgrades the existing per-user installation because every version keeps the same Electron app ID. You do not need to uninstall first.

Settings survive both upgrades and normal uninstall/reinstall cycles. On this Windows installation they live at:

```text
%APPDATA%\plane-pin\settings.json
```

That is normally `C:\Users\<you>\AppData\Roaming\plane-pin\settings.json`. The Plane token is encrypted with Windows DPAPI through Electron `safeStorage`; it is not stored as readable text.

The packaged app also checks for an update after launch. Because the GitHub repository is private, that check runs only when `GH_TOKEN` is set for the user launching Plane Pin. Do not put a GitHub token in the source or installer. A public release-only repository or another public HTTPS update feed would let normal installs update without a token.

When an update is found, `electron-updater` downloads the NSIS installer and installs it when the app exits. GitHub Releases are created automatically when a matching version tag such as `v0.3.0` is pushed.

See `AGENTS.md` for the branch, version, and release rules.

Release history is maintained in `CHANGELOG.md`. The same version entry is used in pull requests, release merge commits, and GitHub Releases.
