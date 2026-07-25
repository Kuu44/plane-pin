# Plane Pin

A compact Electron companion that keeps self-hosted Plane work items in the `started` state group visible above other windows.

## Run

```powershell
npm.cmd install
npm.cmd start
```

Open connection settings and enter:

- Plane base URL, such as `https://plane.example.com`
- workspace slug
- project UUID or readable key, such as `MKTG`
- Plane personal access token

The token is handled only by Electron's main process and persisted with Electron `safeStorage` when OS encryption is available.

For a task URL such as `https://plane.example.com/engineering/browse/MKTG-17/`, enter:

- Plane URL: `https://plane.example.com`
- workspace slug: `engineering`
- project key: `MKTG`

## Check and package

```powershell
npm.cmd test
npm.cmd run dist:win
```

The Windows installer is written to `dist/`.
