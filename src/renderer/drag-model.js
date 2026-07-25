"use strict";

// Shared by the renderer (loaded as a plain script) and by node --test.
(function (root) {
  const defaultThreshold = 4;

  // Tracks a press-and-hold gesture so a short press stays a click that opens a
  // task, while real movement becomes a window drag. Callers pass screen
  // coordinates, which keeps the maths correct across monitors and while the
  // window itself is moving under the pointer.
  function createDragTracker(options = {}) {
    const threshold = Number.isFinite(options.threshold) && options.threshold >= 0
      ? options.threshold
      : defaultThreshold;
    let origin = null;
    let dragging = false;
    let moved = false;

    return {
      threshold,
      isActive: () => origin !== null,
      isDragging: () => dragging,
      start(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        origin = { x, y };
        dragging = false;
        moved = false;
        return true;
      },
      move(x, y) {
        if (!origin || !Number.isFinite(x) || !Number.isFinite(y)) return null;
        const deltaX = x - origin.x;
        const deltaY = y - origin.y;
        if (!dragging && Math.hypot(deltaX, deltaY) < threshold) return null;
        dragging = true;
        moved = true;
        return { deltaX, deltaY };
      },
      end() {
        const dragged = moved;
        origin = null;
        dragging = false;
        moved = false;
        return { dragged };
      },
      cancel() {
        origin = null;
        dragging = false;
        moved = false;
      }
    };
  }

  const api = { createDragTracker, defaultThreshold };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.planePinDrag = api;
})(typeof window !== "undefined" ? window : null);
