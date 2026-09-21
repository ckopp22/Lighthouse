#!/usr/bin/env python3
"""Regenerates icons/*.png (needs Pillow: pip install pillow).

Run from the repo root:  python3 tools/make_icons.py
The artwork mirrors the <symbol id="lh"> lighthouse in index.html.
"""
from pathlib import Path
from PIL import Image, ImageDraw

NAVY_TOP = (27, 66, 117)
NAVY_BOTTOM = (7, 21, 40)
INK = (18, 38, 63)
WHITE = (245, 241, 230)
RED = (200, 64, 47)
GOLD = (255, 209, 102)
ROCK = (59, 74, 94)

OUT = Path(__file__).resolve().parent.parent / "icons"


def draw_icon(size, art_fraction):
    s = size * 4  # supersample, then downscale for smooth edges
    img = Image.new("RGB", (s, s))
    d = ImageDraw.Draw(img)
    for y in range(s):
        t = y / (s - 1)
        d.line([(0, y), (s, y)], fill=tuple(round(NAVY_TOP[i] + (NAVY_BOTTOM[i] - NAVY_TOP[i]) * t) for i in range(3)))

    k = s * art_fraction / 64
    off = (s - 64 * k) / 2

    def pts(points):
        return [(off + x * k, off + y * k) for x, y in points]

    beams = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    b = ImageDraw.Draw(beams)
    b.polygon(pts([(27, 12), (2, 4), (2, 20)]), fill=GOLD + (120,))
    b.polygon(pts([(37, 12), (62, 4), (62, 20)]), fill=GOLD + (120,))
    img.paste(beams, (0, 0), beams)

    d = ImageDraw.Draw(img)
    d.ellipse([off + 12 * k, off + 56 * k, off + 52 * k, off + 63 * k], fill=ROCK)
    d.polygon(pts([(22, 58), (42, 58), (37, 22), (27, 22)]), fill=WHITE, outline=INK, width=max(1, round(1.5 * k)))
    d.polygon(pts([(25.9, 30), (38.1, 30), (39.2, 38), (24.8, 38)]), fill=RED)
    d.polygon(pts([(23.7, 46), (40.3, 46), (41.4, 54), (22.6, 54)]), fill=RED)
    d.rounded_rectangle([off + 23 * k, off + 18.5 * k, off + 41 * k, off + 22.5 * k], radius=k, fill=INK)
    d.rounded_rectangle([off + 27.5 * k, off + 10 * k, off + 36.5 * k, off + 18.5 * k], radius=k, fill=GOLD, outline=INK, width=max(1, round(1.5 * k)))
    d.polygon(pts([(26, 10), (32, 3), (38, 10)]), fill=RED, outline=INK, width=max(1, round(1.5 * k)))

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    draw_icon(192, 0.9).save(OUT / "icon-192.png")
    draw_icon(512, 0.9).save(OUT / "icon-512.png")
    # Maskable icons get cropped to a circle-ish shape: keep art in the inner ~60%.
    draw_icon(512, 0.6).save(OUT / "icon-maskable-512.png")
    print("Wrote", *(p.name for p in sorted(OUT.glob("*.png"))))
