# Plane Pin

A compact Electron companion that keeps your assigned self-hosted Plane work visible above other windows.

## Run

```powershell
npm.cmd install
npm.cmd start
```

The first launch opens a guided setup. You will need:

- Any page address from your logged-in Plane workspace
- A Plane personal access token created under Profile settings
- Your preferred projects and workflow states

Plane Pin normally identifies the token owner automatically. Older self-hosted versions can use the member UUID from a My Work profile URL as a fallback. Tasks are always restricted to that account. You can show every assigned task or select several exact state names from your projects.

The token is handled only by Electron's main process and persisted with Electron `safeStorage` when OS encryption is available.

Onboarding appears only when no completed setup exists. The separate Settings dialog remains available afterward and can change the connection, task filters, grouping, refresh interval, theme, card density, and window behavior. Task rows open their Plane issue in the default browser, and the list refreshes every five minutes by default.

For a task URL such as `https://plane.example.com/engineering/browse/MKTG-17/`, setup detects:

- Plane URL: `https://plane.example.com`
- workspace: `engineering`

## Window behaviour

Plane Pin keeps an icon in the Windows notification area, the macOS menu bar, or the Linux system tray. Closing or minimising the window parks the app on that icon rather than ending it, so the rail stays one click away. Left-click the icon to show or hide the window; right-click it for refresh, always on top, compact cards, Settings, and Exit. Exit from that menu is the only action that really closes Plane Pin.

Both behaviours can be turned off individually under Settings → Window. On a Linux desktop with no system tray, Plane Pin detects the missing icon and keeps ordinary close and minimise behaviour so the window can never be hidden beyond reach.

In task-only mode the window has no title bar, so press and hold anywhere on the rail and move to reposition it. A short press is still a click and opens that task in Plane. This works on Windows, macOS, and X11 Linux sessions; native Wayland does not allow applications to reposition their own windows.

On macOS, Plane Pin uses the native traffic-light controls. They disappear with the rest of the chrome in task-only mode and return when you press `Escape`.

## Compact cards

Settings → Appearance → **Compact cards** reduces each row to the task name and its state icon, dropping the identifier, state label, and due date. Roughly twice as many tasks fit in the same window height. The setting is also on the tray menu, and project headings still follow the separate **Group by project** preference.

## Keyboard shortcuts

macOS uses `Cmd` where the list below says `Ctrl`.

- `Ctrl+Shift+T`: toggle always on top
- `Ctrl+Shift+H`: toggle task-only compact mode
- `Ctrl+Shift+R`: refresh tasks
- `Ctrl+Shift+D`: toggle light/dark theme
- `Ctrl+,`: open settings
- `Escape`: leave compact mode

## Check and package

```powershell
npm.cmd test
npm.cmd run release:win
```

Commit source changes before running the release command. It tests and packages the app, then replaces `builds/` with the current version's installer, source archive, and updater metadata.

macOS and Linux packages are not built on Windows and are not committed to `builds/`. Pushing a version tag builds them on GitHub-hosted macOS and Ubuntu runners and attaches them to that version's GitHub Release:

The same workflow can be run manually on `master` to verify both packages without publishing a release.

| Platform | Assets |
| --- | --- |
| Windows | `Plane-Pin-Setup-vX.Y.Z.exe` (committed to `builds/`) |
| macOS | Universal `.dmg` and `.zip` for Apple Silicon and Intel |
| Linux | `.AppImage` and `.deb` for x64 |

To build one locally on the matching operating system:

```bash
npm run dist:mac     # macOS only
npm run dist:linux   # Linux only
```

### macOS is unsigned

There is no Apple Developer certificate for this project, so the macOS build is neither signed nor notarised. Gatekeeper will refuse the first launch. Open it once with **Control-click → Open**, or clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/Plane Pin.app"
```

Signing and notarising remains open in `TODO.md`.

### Application icon

`build/icon.png` and the tray images under `src/renderer/assets` are generated. Regenerate them only when the mark itself changes:

```bash
python3 scripts/generate-icons.py
```

## Windows upgrades and settings

Running a newer Plane Pin installer upgrades the existing per-user installation because every version keeps the same Electron app ID. You do not need to uninstall first.

Settings survive both upgrades and normal uninstall/reinstall cycles. On this Windows installation they live at:

```text
%APPDATA%\plane-pin\settings.json
```

That is normally `C:\Users\<you>\AppData\Roaming\plane-pin\settings.json`. The Plane token is encrypted with Windows DPAPI through Electron `safeStorage`; it is not stored as readable text.

Settings use one versioned format, are written atomically, and keep the previous valid file as `settings.backup.json`. Upgrade recovery checks that backup plus legacy Plane Pin folder names, then migrates recovered data back to the canonical path. If Windows cannot unlock any saved token, Plane Pin preserves the rest of the setup, opens normally, and asks only for a replacement token in Settings.

The packaged app also checks for an update after launch. Because the GitHub repository is private, that check runs only when `GH_TOKEN` is set for the user launching Plane Pin. Do not put a GitHub token in the source or installer. A public release-only repository or another public HTTPS update feed would let normal installs update without a token.

When an update is found, `electron-updater` downloads the NSIS installer and installs it when the app exits. GitHub Releases are created automatically when a matching version tag such as `v0.3.0` is pushed.

See `AGENTS.md` for the branch, version, and release rules.

Release history is maintained in `CHANGELOG.md`. The same version entry is used in pull requests, release merge commits, and GitHub Releases.
