#!/usr/bin/env python3
"""
Generate styled store-screenshot TEMPLATES (1280x800) into screenshots/.

Each template = RachtaZ-branded background + headline/subtitle + a browser frame
with a "drop your screenshot here" zone. Drop your real player capture into the
zone in any image editor, then export. Run:  python screenshots.py
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "screenshots")
os.makedirs(OUT, exist_ok=True)

W, H = 1280, 800
ACCENT = (255, 77, 77)
GOLD = (240, 196, 70)
WHITE = (242, 242, 246)
GREY = (170, 170, 178)
FONTS = r"C:\Windows\Fonts"

CAPTIONS = [
    ("Chapters right on the timeline", "A gold marker for every game on the seek bar"),
    ("Jump to — or share — any game", "Clickable list with one-click timestamped links"),
    ("Everything in one popup", "Status, game list, shortcuts and toggles"),
]


def font(names, size):
    for n in names:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def bold(s): return font(["segoeuib.ttf", "arialbd.ttf"], s)
def semi(s): return font(["seguisb.ttf", "segoeui.ttf", "arial.ttf"], s)
def reg(s):  return font(["segoeui.ttf", "arial.ttf"], s)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1],
                                           radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def vgrad(w, h, top, bot):
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        col.putpixel((0, y), tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)))
    return col.resize((w, h)).convert("RGBA")


def glow(img, cx, cy, radius, color, alpha):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                              fill=color + (alpha,))
    g = g.filter(ImageFilter.GaussianBlur(radius / 2.2))
    return Image.alpha_composite(img, g)


def diagonals(img, x0, y0, n=3, gap=30, length=560, width=6, color=GOLD, alpha=60):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(n):
        x = x0 + i * gap
        d.line([(x, y0), (x + length, y0 + length)], fill=color + (alpha,), width=width)
    return Image.alpha_composite(img, layer)


def pill(draw, x, y, text, f, fg, bg, pad=(13, 7)):
    bb = draw.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg)
    draw.text((x + pad[0] - bb[0], y + pad[1] - bb[1]), text, font=f, fill=fg)
    return w, h


def dashed_rect(draw, box, color, dash=16, gap=11, width=2):
    x0, y0, x1, y1 = box
    for x in range(x0, x1, dash + gap):
        draw.line([(x, y0), (min(x + dash, x1), y0)], fill=color, width=width)
        draw.line([(x, y1), (min(x + dash, x1), y1)], fill=color, width=width)
    for y in range(y0, y1, dash + gap):
        draw.line([(x0, y), (x0, min(y + dash, y1))], fill=color, width=width)
        draw.line([(x1, y), (x1, min(y + dash, y1))], fill=color, width=width)


def photo_glyph(draw, cx, cy, s, color):
    draw.rounded_rectangle([cx - s, cy - s * 0.72, cx + s, cy + s * 0.72],
                           radius=10, outline=color, width=3)
    draw.ellipse([cx - s * 0.55, cy - s * 0.5, cx - s * 0.3, cy - s * 0.25], outline=color, width=3)
    draw.line([(cx - s * 0.75, cy + s * 0.55), (cx - s * 0.15, cy - s * 0.1),
               (cx + s * 0.25, cy + s * 0.3), (cx + s * 0.55, cy),
               (cx + s * 0.85, cy + s * 0.55)], fill=color, width=3, joint="curve")


def avatar(size):
    a = Image.open(os.path.join(ROOT, "icons", "icon128.png")).convert("RGBA")
    return rounded(a.resize((size, size), Image.LANCZOS), max(8, size // 5))


def build(idx, headline, subtitle, av):
    img = vgrad(W, H, (26, 22, 30), (9, 9, 12))
    img = glow(img, 230, 250, 320, ACCENT, 45)
    img = glow(img, 1120, 90, 240, GOLD, 22)
    img = diagonals(img, 1040, -40, n=3, gap=30, length=560)
    img.paste(av, (56, 48), av)

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    # wordmark + fan-made
    d.text((128, 50), "RachtaZ Stream Enhancer", font=bold(26), fill=WHITE)
    pill(d, 130, 86, "fan-made · unofficial", reg(14), GREY, (255, 255, 255, 20))

    # headline + subtitle
    d.text((56, 132), headline, font=bold(46), fill=WHITE)
    d.text((58, 196), subtitle, font=reg(23), fill=GREY)

    # browser frame
    fx0, fy0, fx1, fy1 = 56, 244, 1224, 754
    d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=16, fill=(18, 18, 20, 255),
                        outline=(255, 255, 255, 30), width=1)
    # title bar
    d.rounded_rectangle([fx0, fy0, fx1, fy0 + 46], radius=16, fill=(32, 32, 36, 255))
    d.rectangle([fx0, fy0 + 30, fx1, fy0 + 46], fill=(32, 32, 36, 255))
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        d.ellipse([fx0 + 20 + i * 22, fy0 + 16, fx0 + 32 + i * 22, fy0 + 28], fill=c)
    # url pill with gold "active" dot
    ux0 = fx0 + 102
    d.rounded_rectangle([ux0, fy0 + 11, ux0 + 460, fy0 + 35], radius=12, fill=(48, 48, 52, 255))
    d.ellipse([ux0 + 12, fy0 + 17, ux0 + 24, fy0 + 29], fill=GOLD)
    d.text((ux0 + 34, fy0 + 15), "youtube.com/watch?v=…  ·  RachtaZ Stream Enhancer active",
           font=reg(13), fill=(200, 200, 205))

    # drop zone
    bx0, by0, bx1, by1 = fx0 + 26, fy0 + 70, fx1 - 26, fy1 - 26
    d.rectangle([bx0, by0, bx1, by1], fill=(12, 12, 14, 255))
    dashed_rect(d, (bx0 + 6, by0 + 6, bx1 - 6, by1 - 6), (120, 110, 80))
    cx, cy = (bx0 + bx1) // 2, (by0 + by1) // 2
    photo_glyph(d, cx, cy - 34, 34, GOLD)
    hint = "Drop your player screenshot here"
    sub = "1280×720 recommended — it will fill this frame"
    for text, fnt, col, dy in [(hint, semi(22), WHITE, 28), (sub, reg(16), GREY, 64)]:
        bb = d.textbbox((0, 0), text, font=fnt)
        d.text((cx - (bb[2] - bb[0]) / 2, cy + dy), text, font=fnt, fill=col)

    img = Image.alpha_composite(img, ov)
    img.convert("RGB").save(os.path.join(OUT, f"screenshot-template-{idx}.png"))


def main():
    av = avatar(60)
    for i, (h, s) in enumerate(CAPTIONS, 1):
        build(i, h, s, av)
    print(f"Wrote {len(CAPTIONS)} templates (1280x800) to screenshots/")


if __name__ == "__main__":
    main()
