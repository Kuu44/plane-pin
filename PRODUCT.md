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

Windows first, used beside day-to-day work. macOS and Linux packages are built from the same Electron source on every version tag. The app lives in the platform's tray surface — notification area, menu bar, or system tray — so it outlives its own window.

## Capabilities and Constraints

- Electron desktop app.
- Guided self-hosted Plane setup from a page URL and personal access token.
- Automatic account, member, project, and workflow-state discovery with a profile URL fallback.
- Shows work items assigned to any selected workspace members across any selected accessible projects.
- Filters by any combination of exact workflow-state names.
- Can group by project, stay above other windows, or hide all app and window chrome in task-only mode.
- Stays in the tray when closed or minimised, with a right-click menu that ends in a real exit.
- Moves by press-and-hold anywhere while the chrome is hidden.
- Offers two card densities: full metadata, or a compact name, estimate, and state mark.
- Shows configured project estimates and offers dot or row-gradient priority treatments.
- Opens task rows in Plane and refreshes automatically on a configurable interval.
- Supports light and dark themes.
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
- One onboarding flow for first launch; one persistent Settings surface afterward.
- One versioned settings format and canonical storage path across upgrades.

## Accessibility & Inclusion

Keyboard-operable controls, visible focus, sufficient contrast, and reduced-motion support are required.
