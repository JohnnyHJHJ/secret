"""Draws icon.png / icon.ico so they match the logo in the app's rail (a little computer with a heart badge).
Run once:  python make_icon.py     Needs Pillow, only for regenerating the icon.
Colors are the default "Dear OS" theme: panel cream, slate outline, plum accent."""
import math
from PIL import Image, ImageDraw

S = 1024
PANEL, PANEL2, LINE2, ACCENT = (234, 230, 222, 255), (224, 218, 207, 255), (111, 106, 98, 255), (158, 79, 112, 255)
BG = (131, 153, 167, 255)                      # the rail's slate blue, used for the soft drop shadow

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# tile: cream square, slate border, hard offset shadow (same look as #rail .logo)
pad, r, off = 56, 120, 38
d.rounded_rectangle((pad + off, pad + off, S - pad + off - 10, S - pad + off - 10), radius=r, fill=LINE2)
d.rounded_rectangle((pad, pad, S - pad - 10, S - pad - 10), radius=r, fill=PANEL, outline=LINE2, width=22)

# the computer, from the 24x24 SVG used in the rail (monitor, stand, title dashes, prompt chevron)
K, CX, CY, W = 34.0, 500, 470, 62               # scale, centre, stroke width
P = lambda x, y: (CX + (x - 12) * K, CY + (y - 12) * K)


def stroke(points, w=W, col=ACCENT):
    pts = [P(*p) for p in points]
    d.line(pts, fill=col, width=w, joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=col)


x0, y0 = P(4, 4)
x1, y1 = P(20, 16)
d.rounded_rectangle((x0, y0, x1, y1), radius=int(1.5 * K) + 10, fill=PANEL2, outline=ACCENT, width=W)
stroke([(9, 20), (15, 20)])
stroke([(12, 16), (12, 20)])
stroke([(7.2, 8), (7.21, 8)])
stroke([(10.2, 8), (13.4, 8)])
stroke([(15.2, 10.2), (16.6, 11.6), (15.2, 13.0)])

# heart badge at the bottom-right corner
bx0, by0, bx1, by1 = 632, 640, 900, 908
d.rectangle((bx0 + 14, by0 + 14, bx1 + 14, by1 + 14), fill=LINE2)
d.rectangle((bx0, by0, bx1, by1), fill=PANEL, outline=LINE2, width=18)
hx, hy, hs = (bx0 + bx1) / 2, (by0 + by1) / 2 + 6, 6.6
heart = []
for i in range(0, 361, 3):
    t = math.radians(i)
    heart.append((hx + hs * 16 * math.sin(t) ** 3,
                  hy - hs * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))))
d.polygon(heart, fill=ACCENT)

img.resize((512, 512), Image.LANCZOS).save("icon.png")
img.save("icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon written")
