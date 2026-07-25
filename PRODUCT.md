# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the brief: one person using a self-hosted Plane workspace who wants active work visible while using other desktop applications.

## Product Purpose

Plane Pin keeps the user's assigned Plane tasks in a small desktop window that can stay above other programs. Success means a first-time user can connect without understanding Plane's API structure, see the right tasks at a glance, and reduce the app to a task-only rail.

## Positioning

A narrow, read-only desktop companion for Plane rather than another general task manager.

## Operating Context

Windows first, used beside day-to-day work. The app should remain portable to macOS and Linux through Electron.

## Capabilities and Constraints

- Electron desktop app.
- Guided self-hosted Plane setup from a page URL and personal access token.
- Automatic account, project, and workflow-state discovery with a profile URL fallback.
- Shows work items assigned to the configured profile across one or all accessible projects.
- Shows all assigned work or filters by several exact project state names.
- Can group by project, stay above other windows, or hide its chrome in task-only mode.
- Read-only in the MVP.
- Credentials must not be committed or exposed to the renderer.
- Exact Plane API shape remains to be verified against the user's hosted version.

## Evidence on Hand

No logo or product assets were supplied. Prior project context identifies a self-hosted Plane instance, but live credentials and API version are intentionally not assumed.

## Product Principles

- Glanceable before comprehensive.
- Read-only before mutating.
- Credentials stay in the desktop main process.
- Native desktop behavior over web-app ceremony.

## Accessibility & Inclusion

Keyboard-operable controls, visible focus, sufficient contrast, and reduced-motion support are required.
