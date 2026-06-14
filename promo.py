#!/usr/bin/env python3
"""
Generate Chrome Web Store promo tiles into promo/:
  - promo-small-440x280.png   (small promo tile)
  - promo-marquee-1400x560.png (marquee promo tile)

Uses the avatar (clipboard hi-res if available, else icons/icon128.png) and the
extension's dark + red theme. Run:  python promo.py
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageGrab

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "promo")
os.makedirs(OUT, exist_ok=True)

ACCENT = (255, 77, 77)
GOLD = (240, 192, 64)   # matches --rse-gold (#f0c040)
WHITE = (242, 242, 246)
GREY = (168, 168, 176)
FONTS = r"C:\Windows\Fonts"


def font(names, size):
    for n in names:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def bold(size): return font(["segoeuib.ttf", "arialbd.ttf"], size)
def semi(size): return font(["seguisb.ttf", "segoeui.ttf", "arial.ttf"], size)
def reg(size):  return font(["segoeui.ttf", "arial.ttf"], size)
def mono(size): return font(["consolab.ttf", "consola.ttf"], size)


def load_avatar():
    im = ImageGrab.grabclipboard()
    if isinstance(im, Image.Image) and min(im.size) >= 256:
        return im.convert("RGBA"), True
    a = (Image.open(os.path.join(ROOT, "icons", "icon128.png"))
         .convert("RGBA").resize((512, 512), Image.LANCZOS)
         .filter(ImageFilter.UnsharpMask(1.3, 95, 2)))
    return a, False


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


def diagonals(img, x0, y0, n=3, gap=26, length=520, width=6, color=GOLD, alpha=70):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(n):
        x = x0 + i * gap
        d.line([(x, y0), (x + length, y0 + length)], fill=color + (alpha,), width=width)
    return Image.alpha_composite(img, layer)


def timeline(draw, x, y, w, h, fracs, played=0.0):
    # Gold played portion + red chapter markers — mirrors the real gold seek bar.
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=(255, 255, 255, 38))
    if played > 0:
        draw.rounded_rectangle([x, y, x + int(w * played), y + h], radius=h // 2, fill=GOLD + (235,))
    for f in fracs:
        mx = x + int(w * f)
        draw.rounded_rectangle([mx - 2, y - 5, mx + 2, y + h + 5], radius=2, fill=ACCENT)


def pill(draw, x, y, text, f, fg, bg, pad=(11, 6)):
    bb = draw.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg)
    draw.text((x + pad[0] - bb[0], y + pad[1] - bb[1]), text, font=f, fill=fg)
    return w, h


FRACS = [0.07, 0.2, 0.33, 0.46, 0.58, 0.71, 0.84, 0.93]


def build_small(avatar):
    W, H = 440, 280
    img = vgrad(W, H, (26, 22, 30), (9, 9, 12))
    img = glow(img, 120, 150, 180, ACCENT, 60)

    av = rounded(avatar.resize((150, 150), Image.LANCZOS), 26)
    img.paste(av, (30, 56), av)

    # Translucent + text elements go on a layer, then composited (proper alpha).
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle([30, 56, 180, 206], radius=26, outline=ACCENT + (160,), width=2)

    d.text((204, 64), "RachtaZ", font=bold(34), fill=WHITE)
    d.text((204, 104), "Stream Enhancer", font=bold(28), fill=ACCENT)
    d.text((205, 146), "Chapters · list · share links", font=reg(15), fill=GREY)

    timeline(d, 206, 188, 200, 7, FRACS, played=0.46)
    pill(d, 206, 214, "fan-made · unofficial", reg(12), GREY, (255, 255, 255, 22))

    img = Image.alpha_composite(img, ov)
    img.convert("RGB").save(os.path.join(OUT, "promo-small-440x280.png"))


def build_marquee(avatar):
    W, H = 1400, 560
    img = vgrad(W, H, (26, 22, 30), (9, 9, 12))
    img = glow(img, 300, 280, 360, ACCENT, 55)
    img = glow(img, 1150, 120, 280, GOLD, 26)
    img = diagonals(img, 1040, -40, n=3, gap=30, length=560)

    av = rounded(avatar.resize((300, 300), Image.LANCZOS), 46)
    img.paste(av, (90, 130), av)

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle([90, 130, 390, 430], radius=46, outline=ACCENT + (150,), width=3)

    d.text((450, 150), "RachtaZ Stream Enhancer", font=bold(70), fill=WHITE)
    d.text((452, 238), "Navigate RachtaZ VODs like a game menu", font=reg(32), fill=GREY)

    timeline(d, 454, 322, 620, 10, FRACS, played=0.46)

    # feature chips (chapters + gold bar are already shown by the timeline motif)
    x = 454
    for txt in ["Clickable game list", "Shareable links", "Resume playback"]:
        w, h = pill(d, x, 360, txt, semi(22), WHITE, (255, 255, 255, 28), pad=(15, 9))
        x += w + 12

    # keyboard keys
    x = 454
    for k in ["N", "P", "L"]:
        w, h = pill(d, x, 418, k, mono(22), WHITE, (255, 255, 255, 36), pad=(13, 8))
        x += w + 10
    d.text((x + 6, 424), "next · previous · list", font=reg(20), fill=GREY)

    pill(d, 454, 470, "fan-made · unofficial · not affiliated with RachtaZ",
         reg(18), GREY, (255, 255, 255, 20), pad=(13, 7))

    img = Image.alpha_composite(img, ov)
    img.convert("RGB").save(os.path.join(OUT, "promo-marquee-1400x560.png"))


def main():
    avatar, hi = load_avatar()
    print("avatar source:", "clipboard hi-res" if hi else "icon128 (upscaled)", avatar.size)
    build_small(avatar)
    build_marquee(avatar)
    print("Wrote promo/promo-small-440x280.png and promo/promo-marquee-1400x560.png")


if __name__ == "__main__":
    main()
