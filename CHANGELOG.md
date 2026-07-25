# Changelog

All notable changes to Plane Pin are documented here.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0] - 2026-07-25

### Added

- Added a Priority appearance setting with Color dot and Card gradient choices; compact color dots are now the default.
- Added project estimate labels to full and compact task rows, including configured T-shirt sizes and legacy numeric estimates.

### Changed

- Compact rows now remove the external-link arrow entirely and keep the workflow-state icon at the right edge.

## [0.8.0] - 2026-07-25

### Added

- Added workspace-member discovery and member multiselects to onboarding and Settings, allowing one person, several people, everyone, or nobody to be shown.
- Added separate onboarding pages for members, projects, and workflow states, each with Select all and Select none actions.

### Changed

- Replaced project and workflow-state mode toggles with consistent multiselect lists that start fully selected.
- Darkened the water-wave texture in both themes; every gradient stop now gives white button text at least 6.0:1 contrast.

### Fixed

- Task filtering now applies selected assignees and exact state names locally after expanding Plane task data, avoiding unreliable self-hosted server-side assignee filtering.
- Preserved v0.8 filter data when quick settings are changed and retained legacy all-project/all-state behavior during settings migration.
- Normalized spacing between member, project, and workflow-state selectors.

## [0.7.1] - 2026-07-25

### Fixed

- Workspace discovery now skips Plane projects the connected account cannot access instead of failing the entire connection.
- Rebuilt every platform package from the same combined source so the Windows installer includes the inaccessible-project fix alongside the v0.7 water-blue UI.

## [0.7.0] - 2026-07-25

### Changed

- Replaced the violet accent with a layered water-blue wave treatment across active controls, primary actions, onboarding details, accent text, and app/tray icons in both themes.
- Enlarged every checkbox to a consistent 22px control with a full-row click target.
- Narrowed the refresh interval selector so its description has more breathing room in the minimum-width window.
- Moved the task link indicator to the bottom-right corner and tightened full and compact task rows to fit more work vertically.

### Fixed

- Settings now reopen at the last scroll position instead of jumping back to the first connection field.

## [0.6.0] - 2026-07-25

### Added

- Added a Plane Pin icon in the Windows notification area, the macOS menu bar, and the Linux system tray. Closing or minimising the window now parks the app there instead of ending it.
- Added a tray menu that shows or hides the window, refreshes tasks, toggles always on top and compact cards, opens Settings, and exits Plane Pin.
- Added press-and-hold dragging anywhere in task-only mode, so the rail moves the way it does from the title bar when the controls are visible.
- Added a Compact cards setting that shows only the task name and its state icon, fitting roughly twice as many tasks on screen.
- Added Window settings for closing and minimising to the tray, described using each platform's own name for that surface.
- Added universal macOS and x64 Linux packages. Every version tag builds them on their native operating systems and attaches them to its GitHub Release.
- Added a Plane Pin application icon and matching tray glyph, including a macOS template image that follows the menu bar's appearance.

### Changed

- Keyboard shortcuts and their tooltips use Command on macOS and Control elsewhere.
- The release workflow builds macOS and Linux packages on their own runners and publishes them together with the tracked Windows installer.
- A second launch reveals the running window instead of starting a rival instance and tray icon.

### Fixed

- Linux packages ship a desktop entry whose `StartupWMClass` matches the executable, plus icons at every standard size from 16px to 1024px, so desktops group Plane Pin windows and show a real icon.
- Desktops without a system tray keep ordinary window behaviour rather than hiding a window that could not be recovered.
- macOS uses its native traffic-light controls and hides them with the rest of the chrome in task-only mode.
- Secure-storage guidance now names the operating system credential store instead of referring only to Windows encryption.
- macOS tray menus avoid unsupported top-level disabled states.

## [0.5.0] - 2026-07-25

### Added

- Added a dedicated Settings dialog that remains available after the one-time onboarding flow.
- Added configurable automatic task refresh, defaulting to every five minutes.
- Added task rows that open their matching Plane issue in the default browser.
- Added light and dark themes in both the app toolbar and Settings.
- Added a frameless compact mode that hides the Windows title bar with the rest of the controls.

### Changed

- Updated the interface to use Inter, Plane-inspired state icons and chips, clearer gear and eye controls, and priority gradients across task cards.
- Replaced the always-on-top control with clearer active and inactive states.

### Fixed

- Settings now use one stable schema and canonical `%APPDATA%\plane-pin` location across versions.
- Token recovery now checks primary, backup, and legacy settings files without replacing newer non-secret preferences.
- Existing users with unreadable saved credentials are sent to Settings instead of being shown onboarding again.
- Removed horizontal scrolling at the minimum window width.
- Release tooling now preserves UTF-8 changelog text.

## [0.4.0] - 2026-07-25

### Added

- Added a guided first-run setup that explains how to find the Plane page address and create a personal access token.
- Added automatic discovery of the token owner, accessible projects, and each project’s exact workflow states.
- Added an All states option and multi-select filtering by exact state names across one or all projects.
- Added a task-only compact mode with a temporary Escape hint and floating window controls.
- Added keyboard shortcuts and hover tooltips for always-on-top, compact mode, refresh, and settings.

### Changed

- Replaced the ambiguous shared status-group selector with Plane’s actual project state names.
- Redesigned the always-on-top control so active and inactive states have distinct labels, icons, colors, and motion.
- Existing installations migrate to All states so no assigned tasks disappear unexpectedly.

### Fixed

- Preserved connection settings when Windows cannot decrypt a saved token instead of resetting the app to first-run defaults.
- Pinned settings to `%APPDATA%\plane-pin`, added atomic writes, and retained a valid settings backup across upgrades.
- Resolved custom states such as “In Review” separately from “In Progress” even when both belong to Plane’s Started group.

## [0.3.1] - 2026-07-25

### Added

- Added a complete release history and an `Unreleased` section for upcoming work.
- Added a pull request template that keeps release descriptions aligned with the changelog.
- Added a release merge command that copies the matching changelog entry into the version merge commit.

### Changed

- GitHub Releases now use the curated changelog entry instead of generated commit notes.

## [0.3.0] - 2026-07-25

### Added

- Added versioned Windows installers, source archives, updater metadata, and automated GitHub Releases.
- Added automatic update checks for packaged installations that have access to the private GitHub repository.
- Added repository rules for feature branches, stable version merges, and release verification.

### Changed

- Windows installers now preserve the stable application identity and user settings during upgrades.
- Release installers are stored with Git LFS under `builds/`.

## [0.2.0] - 2026-07-25

### Added

- Added profile-specific task filtering using the member ID from a Plane profile URL.
- Added assigned-task loading across all accessible projects or one selected project.
- Added shared status-group selection and optional project sections.
- Added inline setup guidance and a Show/Hide control for the personal access token.
- Added support for readable project keys such as `MKTG`.

## [0.1.0] - 2026-07-25

### Added

- Added the initial Windows Electron application with a compact, always-on-top task list.
- Added read-only loading and refreshing of started work items from a self-hosted Plane workspace.
- Added self-hosted Plane connection settings and encrypted token storage through Electron `safeStorage`.
- Added direct task links, keyboard-accessible controls, visible focus, and reduced-motion support.
- Added the first Windows NSIS installer and Plane API tests.

[Unreleased]: https://github.com/Kuu44/plane-pin/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/Kuu44/plane-pin/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Kuu44/plane-pin/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Kuu44/plane-pin/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Kuu44/plane-pin/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Kuu44/plane-pin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Kuu44/plane-pin/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Kuu44/plane-pin/releases/tag/v0.1.0

