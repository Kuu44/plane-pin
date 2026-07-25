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
npm.cmd run dist:win
```

The Windows installer is written to `dist/`.
