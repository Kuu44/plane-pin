# Changelog

All notable changes to Plane Pin are documented here.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Kuu44/plane-pin/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/Kuu44/plane-pin/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Kuu44/plane-pin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Kuu44/plane-pin/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Kuu44/plane-pin/releases/tag/v0.1.0

