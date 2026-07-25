#!/usr/bin/env python3
"""Draw the Plane Pin mark into every icon asset the app and installers need.

Run this only when the mark itself changes:

    python3 scripts/generate-icons.py

It writes build/icon.png (electron-builder derives .ico and .icns from it) and
the tray images under src/renderer/assets. Geometry comes from the pin path in
src/renderer/index.html so the icon, the toolbar control, and the tray glyph
stay the same shape.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
ASSETS = ROOT / "src" / "renderer" / "assets"

ACCENT_TOP = (39, 211, 236)
ACCENT_BOTTOM = (7, 90, 203)
WHITE = (255, 255, 255)
SUPERSAMPLE = 8

# The pin outline from the 20x20 viewBox used by the in-app pin control.
PIN_HEAD = [
    (7.2, 3.5), (12.8, 3.5), (12.1, 7.6), (14.3, 9.8),
    (14.3, 10.9), (5.7, 10.9), (5.7, 9.8), (7.9, 7.6),
]
PIN_STEM = ((10.0, 10.6), (10.0, 16.6))
PIN_STEM_WIDTH = 1.7
VIEWBOX = 20.0


def draw_pin(draw, colour, size, scale, offset_x, offset_y):
    """Paint the pin glyph so it fills `scale` of a `size` square."""
    unit = size * scale / VIEWBOX
    left = (size - VIEWBOX * unit) / 2 + offset_x
    top = (size - VIEWBOX * unit) / 2 + offset_y

    def place(point):
        return (left + point[0] * unit, top + point[1] * unit)

    draw.polygon([place(point) for point in PIN_HEAD], fill=colour)
    draw.line(
        [place(PIN_STEM[0]), place(PIN_STEM[1])],
        fill=colour,
        width=max(1, round(PIN_STEM_WIDTH * unit)),
    )


def vertical_gradient(size, top, bottom):
    gradient = Image.new("RGB", (1, size))
    for y in range(size):
        ratio = y / max(1, size - 1)
        gradient.putpixel((0, y), tuple(
            round(top[channel] + (bottom[channel] - top[channel]) * ratio)
            for channel in range(3)
        ))
    return gradient.resize((size, size))


def rounded_mask(size, radius_ratio):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * radius_ratio), fill=255
    )
    return mask


def app_icon(size):
    canvas = size * SUPERSAMPLE if size <= 128 else size
    badge = vertical_gradient(canvas, ACCENT_TOP, ACCENT_BOTTOM).convert("RGBA")
    badge.putalpha(rounded_mask(canvas, 0.225))
    glyph = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw_pin(ImageDraw.Draw(glyph), WHITE + (255,), canvas, 0.5, 0, -canvas * 0.012)
    badge.alpha_composite(glyph)
    return badge.resize((size, size), Image.LANCZOS)


def tray_badge(size):
    """Windows and Linux: a water-blue chip that reads on light and dark bars."""
    canvas = size * SUPERSAMPLE
    badge = vertical_gradient(canvas, ACCENT_TOP, ACCENT_BOTTOM).convert("RGBA")
    badge.putalpha(rounded_mask(canvas, 0.26))
    glyph = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw_pin(ImageDraw.Draw(glyph), WHITE + (255,), canvas, 0.62, 0, -canvas * 0.015)
    badge.alpha_composite(glyph)
    return badge.resize((size, size), Image.LANCZOS)


def tray_template(size):
    """macOS: black on transparent so the system tints it for the active bar."""
    canvas = size * SUPERSAMPLE
    glyph = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw_pin(ImageDraw.Draw(glyph), (0, 0, 0, 255), canvas, 0.78, 0, 0)
    return glyph.resize((size, size), Image.LANCZOS)


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    app_icon(1024).save(BUILD / "icon.png")
    # Packaged inside src/ so the Linux window icon survives asar packing.
    app_icon(256).save(ASSETS / "app-icon.png")

    # Linux desktops pick the nearest size from this set instead of downscaling
    # a single 1024px image in every menu.
    icons = BUILD / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 64, 128, 256, 512, 1024):
        app_icon(size).save(icons / f"{size}x{size}.png")

    for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
        tray_badge(16 * scale).save(ASSETS / f"tray{suffix}.png")

    for scale, suffix in ((1, ""), (2, "@2x")):
        tray_template(16 * scale).save(ASSETS / f"trayTemplate{suffix}.png")

    print("Wrote build/icon.png and the tray images under src/renderer/assets.")


if __name__ == "__main__":
    main()
