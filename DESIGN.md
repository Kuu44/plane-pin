---
name: Plane Pin
description: A compact desktop rail for active Plane work.
colors:
  accent-light: "#087fd7"
  accent-light-hover: "#0569bc"
  accent-light-soft: "#e7f5ff"
  accent-dark: "#56bfff"
  accent-dark-hover: "#78ceff"
  accent-dark-soft: "#102c40"
  wave-deep: "#063b78"
  wave-mid: "#075a91"
  wave-teal: "#086d7c"
  wave-radial-light: "#0b6578"
  text-wave-deep: "#0758b8"
  text-wave-mid: "#087fc8"
  text-wave-teal: "#078ca2"
  wave-radial-dark: "#0c6677"
  wave-radial-dark-blue: "#0b6088"
  text-wave-dark-blue: "#58c6f2"
  text-wave-dark-teal: "#43d4d2"
  canvas-light: "#f7f7f8"
  surface-light: "#ffffff"
  ink-light: "#202124"
  muted-light: "#6b6f76"
  divider-light: "#e2e3e7"
  canvas-dark: "#17171a"
  surface-dark: "#1d1d21"
  ink-dark: "#ececf0"
  muted-dark: "#a8a8b0"
  divider-dark: "#34343a"
  success: "#2c8d4e"
  danger-window: "#c42b1c"
  danger-toast: "#5c2330"
  shortcut-surface: "#3b3c45"
  shadow-soft: "rgba(0, 0, 0, 0.24)"
  shadow-medium: "rgba(0, 0, 0, 0.3)"
  shadow-strong: "rgba(0, 0, 0, 0.32)"
  compact-shadow: "rgba(20, 18, 36, 0.2)"
typography:
  micro:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.4
  support:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
  detail:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  section-title:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.3
  title:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  empty-title:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  dialog-title:
    fontFamily: "Inter Variable, Inter, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  code:
    fontFamily: "IBM Plex Mono, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  hairline: "1px"
  insertion: "2px"
  dot: "3px"
  badge: "4px"
  tray: "5px"
  checkbox: "6px"
  control: "7px"
  button: "8px"
  floating-control: "9px"
  floating-action: "10px"
  feature: "12px"
  dialog: "14px"
spacing:
  compact: "8px"
  row: "15px 18px"
  section: "18px"
  dialog: "20px"
components:
  button-primary:
    backgroundColor: "water-wave gradient"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.button}"
    height: "38px"
  button-primary-hover:
    backgroundColor: "water-wave gradient with lifted shadow"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.button}"
---

# Design System: Plane Pin

## Overview

**Creative North Star: "The Waterline Work Rail"**

Plane Pin should feel like a narrow strip of moving water attached to the edge of a monitor: calm, dense, and immediately legible. It is an operating surface, so expression lives in precise alignment, a layered water-blue signal, and a compact silhouette rather than decorative chrome.

**Key Characteristics:**

- Quiet neutral canvas with one deep-to-clear water-blue accent.
- Information-first rows instead of a card grid.
- Compact controls that remain unmistakably interactive.

## Colors

Restrained: cool near-white and ink neutrals, with water blue reserved for active state and focus. The accent is a layered radial-and-linear wave: deep blue carries contrast and teal supplies movement. Every stop keeps white action labels above 6:1 contrast.

**The Signal Rule.** Water blue marks selection, action, or live state; it is not background decoration. Bold accent labels may clip the wave into their text, while ordinary copy remains solid for legibility.

## Typography

Use bundled Inter to echo Plane while keeping system fonts as a fallback. Weight and spacing create hierarchy; no display face is needed. Dialog titles use a compact 19px/1.2 scale, rail headings use 17px, and task rows use 13px/1.35.

## Layout

One vertical rail: a frameless title bar, explicit window-state controls, connection/status strip, then a scrollable task list. The window stays useful from 320px wide without horizontal scrolling. Sections use 18px insets and task rows use 15px × 18px padding. Compact mode removes all chrome and leaves subdued floating controls above the task rail.

Because compact mode removes the title bar, the whole rail becomes the drag handle: press and hold anywhere and move. A press that travels less than 4px stays a click, so a task still opens. The rail keeps its own hint clear of the floating controls rather than overlapping them.

Card density is a separate axis from chrome. **Compact cards** keeps the name, estimate, and state mark and drops the identifier, state label, due date, and link arrow. The estimate sits immediately before the state mark, which owns the right edge. Density changes what a row says, never where the rail lives.

macOS keeps native inset traffic lights rather than imitating Windows controls. The custom title area clears their footprint, and task-only mode hides them until the controls return.

## Elevation & Depth

The app is flat internally. Window elevation belongs to the operating system; inside, tonal surfaces and 1px separators establish depth. Action shadows use a visible vertical offset and soft blur.

## Shapes

Controls use gently rounded corners (7–10px); dialogs use 14px. Task rows remain rectilinear so identifiers, names, and metadata align into a stable reading rhythm.

## Components

- **Primary action:** water-wave fill, white label, 38px minimum height, 8px corners.
- **Pin control:** a labeled state button; active uses the water-wave fill and a check, inactive reads “Normal window.”
- **Task row:** border-separated list item with a priority dot by default, an optional left-to-transparent priority gradient, aligned metadata, a restrained estimate badge, and a Plane-like boxed state chip.
- **Compact task row:** the same row at 7px vertical padding, with a one-line name, optional estimate badge, and unboxed state mark at the right edge. It never shows the external-link arrow and uses the selected dot or gradient priority treatment.
- **Tray icon:** the app mark as a water-blue chip on Windows and Linux, and a black template image on macOS so the system tints it for the active menu bar. Its menu names the platform's own surface — notification area, menu bar, or system tray — and always ends in a real exit.
- **Input:** cool neutral field with a 1px divider-colored border and water-blue focus state.
- **Onboarding:** a seven-view progressive dialog with separate member, project, and workflow-state choices that performs real connection setup and ends at the first loaded task list.
- **Settings:** a separate persistent dialog for every connection, filter, refresh, theme, and window preference.
- **Update row:** one plain status sentence and one contextual action. Progress appears only while downloading; credential and platform limitations remain explicit.
- **Filter chooser:** flat member, project, and state rows with consistent spacing, full-row reorder previews, and Select all and Select none actions.
- **Completion action:** a right-edge check control with one restrained hover halo; success creates a reversible toast instead of immediately removing context.

## Do's and Don'ts

### Do:

- **Do** keep the in-progress list visible without navigation.
- **Do** use native platform affordances for window behavior.
- **Do** call the tray by the name each platform uses for it.
- **Do** make connection and empty states actionable.
- **Do** reveal one setup decision at a time and keep the task list as the completion moment.

### Don't:

- **Don't** turn each task into a floating dashboard card.
- **Don't** expose API credentials in renderer code or persisted plain text.
- **Don't** describe Plane’s five state groups as if they were the user’s exact workflow state names.
- **Don't** add task mutations without an explicit target state, visible feedback, and a working Undo path.
- **Don't** hide the window anywhere the user cannot get it back from.
