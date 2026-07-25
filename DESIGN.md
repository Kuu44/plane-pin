---
name: Plane Pin
description: A compact desktop rail for active Plane work.
colors:
  accent: "#087fd7"
  accent-hover: "#0569bc"
  canvas: "#f6f7fb"
  surface: "#ffffff"
  ink: "#171821"
  muted: "#686b78"
  divider: "#e4e5ec"
typography:
  body:
    fontFamily: "Inter Variable, Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  title:
    fontFamily: "Inter Variable, Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
rounded:
  control: "9px"
  action: "10px"
  dialog: "16px"
spacing:
  compact: "8px"
  row: "15px 18px"
  section: "18px"
components:
  button-primary:
    backgroundColor: "water-wave gradient"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
    height: "40px"
  button-primary-hover:
    backgroundColor: "water-wave gradient with lifted shadow"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
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

Restrained: cool near-white and ink neutrals, with water blue reserved for active state and focus. The accent is a layered radial-and-linear wave: deep blue carries contrast, cyan supplies movement, and pale blue adds the crest.

**The Signal Rule.** Water blue marks selection, action, or live state; it is not background decoration. Bold accent labels may clip the wave into their text, while ordinary copy remains solid for legibility.

## Typography

Use bundled Inter to echo Plane while keeping system fonts as a fallback. Weight and spacing create hierarchy; no display face is needed. Titles use a compact 19px/1.2 scale, while rows use a 14px/1.35 scale.

## Layout

One vertical rail: a frameless title bar, explicit window-state controls, connection/status strip, then a scrollable task list. The window stays useful from 320px wide without horizontal scrolling. Sections use 18px insets and task rows use 15px × 18px padding. Compact mode removes all chrome and leaves subdued floating controls above the task rail.

Because compact mode removes the title bar, the whole rail becomes the drag handle: press and hold anywhere and move. A press that travels less than 4px stays a click, so a task still opens. The rail keeps its own hint clear of the floating controls rather than overlapping them.

Card density is a separate axis from chrome. **Compact cards** keeps the name and the state mark and drops the identifier, the state label, and the due date, moving the mark to the right edge on the same line. Density changes what a row says, never where the rail lives.

macOS keeps native inset traffic lights rather than imitating Windows controls. The custom title area clears their footprint, and task-only mode hides them until the controls return.

## Elevation & Depth

The app is flat internally. Window elevation belongs to the operating system; inside, tonal surfaces and 1px separators establish depth. Action shadows use a visible vertical offset and soft blur.

## Shapes

Controls use gently rounded corners (9–10px); dialogs use 16px. Task rows remain rectilinear so identifiers, names, and metadata align into a stable reading rhythm.

## Components

- **Primary action:** water-wave fill, white label, 40px minimum height, 10px corners.
- **Pin control:** a labeled state button; active uses the water-wave fill and a check, inactive reads “Normal window.”
- **Task row:** border-separated list item with a left-to-transparent priority gradient, aligned metadata, and a Plane-like boxed state chip.
- **Compact task row:** the same row at 7px vertical padding, name truncated to one line, state mark unboxed and right-aligned, with the hover link affordance reserved at the far edge. The priority gradient stays, because at this density it is the only remaining priority signal.
- **Tray icon:** the app mark as a water-blue chip on Windows and Linux, and a black template image on macOS so the system tints it for the active menu bar. Its menu names the platform's own surface — notification area, menu bar, or system tray — and always ends in a real exit.
- **Input:** cool neutral field with a 1px divider-colored border and water-blue focus state.
- **Onboarding:** a six-view progressive dialog that performs real connection setup and ends at the first loaded task list.
- **Settings:** a separate persistent dialog for every connection, filter, refresh, theme, and window preference.
- **State chooser:** flat selectable rows populated from the connected Plane projects, grouped semantically without hiding custom names.

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
- **Don't** add task-editing controls until read-only retrieval is proven.
- **Don't** hide the window anywhere the user cannot get it back from.
