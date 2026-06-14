#!/usr/bin/env python3
"""
Build FINISHED store screenshots (1280x800) from a user-provided capture.

Composites the capture as the YouTube video, then draws the full extension UI on
top: gold seek bar + red chapter markers, player buttons, the game list panel,
and the resume/like toasts. RachtaZ-branded header band.

Input : screenshots/_user_capture.png   (your gameplay capture, any size)
Output: screenshots/store-shot-1.png … store-shot-3.png
Run   : python store_shots.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SDIR = os.path.join(ROOT, "screenshots")
SRC = os.path.join(SDIR, "_user_capture.png")

W, H = 1280, 800
ACCENT = (255, 77, 77)
GOLD = (240, 192, 64)
WHITE = (242, 242, 246)
GREY = (170, 170, 178)
FONTS = r"C:\Windows\Fonts"

# Video rect (16:9) under a header band.
VX0, VY0 = 24, 104
VW, VH = 1232, 693
VX1, VY1 = VX0 + VW, VY0 + VH

GAMES = [
    ("0:15:26", "Intro & warm-up"), ("0:51:41", "Game 1"), ("1:01:05", "Game 2"),
    ("1:23:45", "Game 3"), ("1:58:12", "Game 4"), ("2:30:00", "Game 5"),
    ("3:05:33", "Game 6"), ("3:48:10", "Game 7"), ("4:30:00", "Game 8"),
]
CUR = 3                      # current game index (highlighted)
PLAYED = 0.23                # progress fraction
MARK_FRACS = [0.04, 0.14, 0.17, 0.23, 0.33, 0.41, 0.51, 0.63, 0.74]


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


def cover(im, w, h):
    iw, ih = im.size
    s = max(w / iw, h / ih)
    im2 = im.resize((int(iw * s), int(ih * s)), Image.LANCZOS)
    x = (im2.size[0] - w) // 2
    y = (im2.size[1] - h) // 2
    return im2.crop((x, y, x + w, y + h))


def avatar(size):
    a = Image.open(os.path.join(ROOT, "icons", "icon128.png")).convert("RGBA")
    return rounded(a.resize((size, size), Image.LANCZOS), max(8, size // 5))


def textw(d, t, f):
    bb = d.textbbox((0, 0), t, font=f)
    return bb[2] - bb[0]


def pill(d, x, y, text, f, fg, bg, pad=(12, 6)):
    tw = textw(d, text, f)
    th = d.textbbox((0, 0), text, font=f)[3]
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg)
    d.text((x + pad[0], y + pad[1] - 1), text, font=f, fill=fg)
    return w, h


# ── control-bar glyphs (white), centred on cy ──────────────────────────────
def g_play(d, x, cy, s, c):
    d.polygon([(x, cy - s), (x, cy + s), (x + s * 1.6, cy)], fill=c)
    return int(s * 1.6)


def g_prev(d, x, cy, s, c):
    d.rectangle([x, cy - s, x + s * 0.4, cy + s], fill=c)
    d.polygon([(x + s * 1.7, cy - s), (x + s * 1.7, cy + s), (x + s * 0.5, cy)], fill=c)
    return int(s * 1.7)


def g_next(d, x, cy, s, c):
    d.polygon([(x, cy - s), (x, cy + s), (x + s * 1.2, cy)], fill=c)
    d.rectangle([x + s * 1.3, cy - s, x + s * 1.7, cy + s], fill=c)
    return int(s * 1.7)


def g_list(d, x, cy, s, c):
    for i, dy in enumerate((-s, 0, s)):
        w = s * 2 if i < 2 else s * 1.3
        d.rounded_rectangle([x, cy + dy - 1, x + w, cy + dy + 1], radius=1, fill=c)
    return int(s * 2)


def g_gear(d, x, cy, s, c):
    d.ellipse([x, cy - s, x + 2 * s, cy + s], outline=c, width=2)
    d.ellipse([x + s * 0.6, cy - s * 0.4, x + s * 1.4, cy + s * 0.4], fill=c)
    return int(2 * s)


def g_full(d, x, cy, s, c):
    for sx, sy in [(0, -1), (1, -1), (0, 1), (1, 1)]:
        cx = x + (0 if sx == 0 else 2 * s)
        yy = cy + sy * s
        hx = s * 0.7 * (1 if sx == 0 else -1)
        vy = -sy * s * 0.7
        d.line([(cx, yy), (cx + hx, yy)], fill=c, width=2)
        d.line([(cx, yy), (cx, yy + vy)], fill=c, width=2)
    return int(2 * s)


def g_copy(d, x, cy, s, c):
    d.rounded_rectangle([x + 3, cy - s + 3, x + 3 + 2 * s, cy + s + 3], radius=2, outline=c, width=2)
    d.rounded_rectangle([x, cy - s, x + 2 * s, cy + s], radius=2, outline=c, width=2)


def g_thumb(d, x, cy, s, c):
    d.rounded_rectangle([x, cy - s * 0.2, x + s * 1.5, cy + s * 1.1], radius=2, fill=c)
    d.rounded_rectangle([x + s * 0.45, cy - s * 1.3, x + s * 1.05, cy], radius=2, fill=c)
    d.rounded_rectangle([x - s * 0.55, cy + s * 0.1, x, cy + s * 1.1], radius=1, fill=c)


def bottom_grad(w, h, max_a=225):
    g = Image.new("RGBA", (1, h), (0, 0, 0, 0))
    for y in range(h):
        a = int(max_a * (y / (h - 1)) ** 1.5)
        g.putpixel((0, y), (0, 0, 0, a))
    return g.resize((w, h))


def draw_controls(base):
    grad = bottom_grad(VW, 150)
    base.alpha_composite(grad, (VX0, VY1 - 150))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    # progress bar
    px0, px1 = VX0 + 26, VX1 - 26
    py = VY1 - 58
    d.rounded_rectangle([px0, py, px1, py + 5], radius=3, fill=(255, 255, 255, 70))
    pw = px1 - px0
    d.rounded_rectangle([px0, py, px0 + int(pw * PLAYED), py + 5], radius=3, fill=GOLD)
    for f in MARK_FRACS:
        mx = px0 + int(pw * f)
        d.rounded_rectangle([mx - 2, py - 5, mx + 2, py + 10], radius=2, fill=ACCENT)
    kx = px0 + int(pw * PLAYED)
    d.ellipse([kx - 8, py - 6, kx + 8, py + 10], fill=GOLD)

    # left controls
    cy = VY1 - 28
    x = VX0 + 26
    x += g_play(d, x, cy, 9, WHITE) + 22
    x += g_prev(d, x, cy, 8, WHITE) + 18
    # our "Next — Game X" pill-ish (icon + text)
    x += g_next(d, x, cy, 8, WHITE) + 8
    nxt = f"Next — {GAMES[CUR + 1][1]}"
    d.text((x, cy - 11), nxt, font=semi(19), fill=WHITE)
    x += textw(d, nxt, semi(19)) + 20
    x += g_list(d, x, cy, 8, WHITE) + 22
    t = "1:23:45 / 6:02:11"
    d.text((x, cy - 9), t, font=reg(15), fill=(220, 220, 224))

    # right controls
    rx = VX1 - 26
    rx -= g_full(d, rx - 18, cy, 9, WHITE)
    rx -= 26
    g_gear(d, rx - 18, cy, 9, WHITE)

    base.alpha_composite(ov)


def draw_panel(base):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    pw, ph = 300, 366
    x0, y0 = VX1 - pw - 22, VY0 + 22
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=14, fill=(20, 20, 22, 240),
                        outline=(255, 255, 255, 28), width=1)
    d.text((x0 + 16, y0 + 13), f"Games · {len(GAMES)}", font=bold(15), fill=WHITE)
    d.text((x0 + pw - 28, y0 + 10), "×", font=reg(18), fill=GREY)
    ry = y0 + 48
    rh = 34
    for i, (tc, label) in enumerate(GAMES):
        active = (i == CUR)
        if active:
            d.rounded_rectangle([x0 + 8, ry, x0 + pw - 8, ry + rh], radius=8,
                                fill=(255, 77, 77, 40))
            d.rounded_rectangle([x0 + 8, ry, x0 + 11, ry + rh], radius=2, fill=ACCENT)
        nb = ACCENT if active else (255, 255, 255, 26)
        d.ellipse([x0 + 16, ry + 8, x0 + 34, ry + 26], fill=nb)
        d.text((x0 + 20, ry + 9), str(i + 1), font=bold(11), fill=WHITE)
        d.text((x0 + 44, ry + 9), tc, font=semi(11), fill=GOLD)
        d.text((x0 + 104, ry + 8), label, font=reg(13), fill=(235, 235, 238))
        g_copy(d, x0 + pw - 36, ry + rh // 2 - 1, 5, (150, 150, 156))
        ry += rh + 2
    base.alpha_composite(ov)


def draw_resume(base):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    x, y = VX0 + 26, VY1 - 210
    txt = "Resume at "
    bold_t = "1:20:05"
    f1, f2 = reg(16), bold(16)
    btn = "Resume"
    bw = textw(d, btn, semi(15)) + 32
    w = 18 + textw(d, txt, f1) + textw(d, bold_t, f2) + 14 + bw + 14 + 18
    h = 50
    d.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=(20, 20, 22, 245),
                        outline=(255, 255, 255, 30), width=1)
    tx = x + 16
    d.text((tx, y + 16), txt, font=f1, fill=WHITE)
    tx += textw(d, txt, f1)
    d.text((tx, y + 16), bold_t, font=f2, fill=WHITE)
    tx += textw(d, bold_t, f2) + 12
    d.rounded_rectangle([tx, y + 11, tx + bw, y + h - 11], radius=8, fill=ACCENT)
    d.text((tx + 16, y + 16), btn, font=semi(15), fill=WHITE)
    base.alpha_composite(ov)


def draw_like(base):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    txt = "Enjoying it? "
    bold_t = "Like RachtaZ's video"
    f1, f2 = reg(19), bold(19)
    btn = "Like"
    bw = textw(d, btn, semi(17)) + 56
    w = 22 + textw(d, txt, f1) + textw(d, bold_t, f2) + 16 + bw + 16 + 22
    h = 58
    x = VX0 + (VW - w) // 2
    y = VY0 + 26
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=(20, 20, 22, 245),
                        outline=(255, 255, 255, 30), width=1)
    tx = x + 20
    d.text((tx, y + 18), txt, font=f1, fill=WHITE)
    tx += textw(d, txt, f1)
    d.text((tx, y + 18), bold_t, font=f2, fill=WHITE)
    tx += textw(d, bold_t, f2) + 14
    d.rounded_rectangle([tx, y + 12, tx + bw, y + h - 12], radius=10, fill=ACCENT)
    g_thumb(d, tx + 16, y + h // 2, 7, WHITE)
    d.text((tx + 40, y + 18), btn, font=semi(17), fill=WHITE)
    base.alpha_composite(ov)


def header(base, headline, av):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    base.alpha_composite(av, (24, 28))
    d.text((82, 24), "RachtaZ Stream Enhancer", font=bold(21), fill=WHITE)
    pill(d, 84, 52, "fan-made · unofficial", reg(12), GREY, (255, 255, 255, 20))
    hw = textw(d, headline, bold(28))
    d.text((W - 28 - hw, 36), headline, font=bold(28), fill=WHITE)
    base.alpha_composite(ov)


def build(idx, headline, opts, user_img, av):
    base = Image.new("RGBA", (W, H), (14, 13, 16, 255))
    vid = rounded(cover(user_img, VW, VH), 14)
    base.alpha_composite(vid, (VX0, VY0))
    draw_controls(base)
    if opts.get("panel"):
        draw_panel(base)
    if opts.get("resume"):
        draw_resume(base)
    if opts.get("like"):
        draw_like(base)
    header(base, headline, av)
    base.convert("RGB").save(os.path.join(SDIR, f"store-shot-{idx}.png"))


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"Missing capture: put your screenshot at {SRC}")
    user_img = Image.open(SRC).convert("RGB")
    av = avatar(44)
    shots = [
        ("Chapters & a gold seek bar, in the player", {}),
        ("Clickable game list — jump or share any game", {"panel": True}),
        ("Resume & support, in one click", {"resume": True, "like": True}),
    ]
    for i, (h, o) in enumerate(shots, 1):
        build(i, h, o, user_img, av)
    print(f"Wrote {len(shots)} store screenshots (1280x800) to screenshots/")


if __name__ == "__main__":
    main()
