"""UI art: title logo, empty-slot markers, the OOPS! loss card, app icons."""
import sys, math, os; sys.path.insert(0, 'art_src')
from cards import *
from font import render, text_width
from kings import KP, king_card
from PIL import Image

OUT = (43,36,32,255)
FELT_LINE = (78,104,84,255)
os.makedirs('out/ui', exist_ok=True); os.makedirs('out/icons', exist_ok=True)

# ------------------------------------------------------------------ logo
def stylize(mask_img, top, bot):
    """gold gradient fill, 1px outline, 1px drop shadow"""
    w, h = mask_img.size
    out = Image.new('RGBA', (w + 4, h + 4), (0,0,0,0)); px = out.load()
    m = mask_img.load()
    solid = {(x+2, y+2) for y in range(h) for x in range(w) if m[x, y][3]}
    ring = {(x+dx, y+dy) for (x, y) in solid for dx in (-1,0,1) for dy in (-1,0,1)} - solid
    for (x, y) in {(x+1, y+1) for (x, y) in solid | ring} - solid - ring: px[x, y] = (24,34,28,255)   # shadow
    for (x, y) in ring: px[x, y] = OUT
    for (x, y) in solid:
        t = (y - 2) / max(1, h - 1)
        px[x, y] = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        if (x, y - 1) in ring: px[x, y] = (250,232,170,255)          # top-edge shine
    return out

def logo():
    big = stylize(render("JOHN'S", scale=2), (236,198,104), (190,128,52))
    small = stylize(render("SOLITAIRE", spacing=2), (238,228,206), (206,190,160))
    W_ = max(big.width, small.width + 24)
    img = Image.new('RGBA', (W_, big.height + small.height + 1), (0,0,0,0))
    img.alpha_composite(big, ((W_ - big.width)//2, 0))
    sy = big.height + 1
    img.alpha_composite(small, ((W_ - small.width)//2, sy))
    # spade ornaments either side of SOLITAIRE
    for ox in ((W_ - small.width)//2 - 10, (W_ + small.width)//2 + 2):
        stamp(img, PIPS7['S'], ox, sy + 3, (236,198,104,255))
    return img

# ------------------------------------------------------------------ slots
def card_outline(dashed=False, fill=(0,0,0,46)):
    img = Image.new('RGBA', (W, H), (0,0,0,0)); px = img.load()
    for y in range(H):
        for x in range(W):
            edge = x in (0, W-1) or y in (0, H-1)
            corner = (x in (0, W-1)) and (y in (0, H-1))
            if corner: continue
            if edge:
                if not dashed or ((x + y) // 3) % 2 == 0: px[x, y] = FELT_LINE
            else: px[x, y] = fill
    for (x, y) in [(1,1),(W-2,1),(1,H-2),(W-2,H-2)]: px[x, y] = FELT_LINE
    return img

def foundation(suit):
    img = card_outline()
    big = scale_up(PIPS9[suit], 2)
    stamp(img, big, (W - len(big[0]))//2, (H - len(big))//2, FELT_LINE)
    return img

def recycle():
    img = card_outline(); px = img.load()
    cx, cy = W/2 - .5, H/2 - .5
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, y - cy); a = math.degrees(math.atan2(y - cy, x - cx)) % 360
            if 7 <= d < 9.5 and not (300 < a < 345): px[x, y] = FELT_LINE
    ang = math.radians(300); r = 8.25
    bx, by = cx + r*math.cos(ang), cy + r*math.sin(ang)
    tx, ty = -math.sin(ang), math.cos(ang); nx, ny = math.cos(ang), math.sin(ang)
    tri = [(bx + 4.5*tx, by + 4.5*ty), (bx + 3.2*nx - .5*tx, by + 3.2*ny - .5*ty), (bx - 3.2*nx - .5*tx, by - 3.2*ny - .5*ty)]
    def inside(x, y):
        def sgn(a, b, c): return (x - c[0])*(b[1] - c[1]) - (b[0] - c[0])*(y - c[1])
        d1, d2, d3 = sgn(0,*tri[:2]) if False else None, None, None
        s1 = (x - tri[1][0])*(tri[0][1] - tri[1][1]) - (tri[0][0] - tri[1][0])*(y - tri[1][1])
        s2 = (x - tri[2][0])*(tri[1][1] - tri[2][1]) - (tri[1][0] - tri[2][0])*(y - tri[2][1])
        s3 = (x - tri[0][0])*(tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0])*(y - tri[0][1])
        return (s1 < 0) == (s2 < 0) == (s3 < 0)
    for y in range(H):
        for x in range(W):
            if inside(x + .5, y + .5): px[x, y] = FELT_LINE
    return img

def select_ring():
    img = Image.new('RGBA', (W + 4, H + 4), (0,0,0,0)); px = img.load()
    for y in range(H + 4):
        for x in range(W + 4):
            if (x in (0, 1, W+2, W+3) or y in (0, 1, H+2, H+3)) and not ((x in (0, W+3)) and (y in (0, H+3))):
                px[x, y] = (236,198,104,255) if (x in (0, W+3) or y in (0, H+3)) else (250,232,170,255)
    return img

# ------------------------------------------------------------------ OOPS! card: fedora John, tongue out
LP = dict(KP)
LP.update({k: v + (255,) for k, v in {
 '3': (58,56,56), '4': (92,90,88), '5': (28,26,26),                 # fedora
 'l': (230,204,180), 'e': (46,34,28),                               # clear lenses, squeezed-shut eyes
 'T': (214,98,108), 't': (170,64,76),                               # the tongue
 '9': (120,150,196), '8': (92,118,160), 'b': (36,34,34), 'a': (224,212,186),  # scarf, coat, sherpa
}.items()})
OOPS = [
 "...................",
 "...........oooo....",
 "..........o3333oooo",
 ".........o433333333",
 ".........o333333333",
 ".........o333333333",
 ".........o555555555",
 "....ooooo3333333333",
 "...o444444444444444",
 "....ooooooooooooooo",
 ".........odsGGGGsss",  # 10 brows way up
 ".........osfffffffs",
 ".......osdsflllllfs",
 ".......osdsflleelfs"[:0] or ".......osdsfllelllfs"[:19],
 ".......osdsflelelfs",
 ".......osdsfflllffd",
 ".......osdssffffssd",
 ".......osddssssssdh",
 ".........odssssdddd",
 ".........odssgggggg",
 ".........odsgggPggg",  # 20
 ".........odsggGGGGG",
 ".........odsggsmmmm",  #    mouth open
 "..........odgGsmTTT",  #    tongue
 "...........odssTTTt",
 "............oddTTTt",
 ".............ooTTTt",
 "..............odddd",
 ".......ooaaaaaadddd",
 ".....obaaa989898989",
 "....obbbaa898989898",  # 30
 "...obbbbbba98989898",
 "...obbbbbbbb8989898",
 "..obbbbbbbbbb989898",
]
OOPS[13] = ".......osdsfllelllfs"[:18] + "s"
OOPS[13] = ".......osdsfllellfs"

def burst(x, y):
    a = math.atan2(y - 16, x - 18.5)
    return (206,164,74,255) if int((a + math.pi) / (math.pi / 8)) % 2 else (186,142,58,255)

def loss_card():
    rows = []
    for h in OOPS:
        assert len(h) == 19, (len(h), h)
        rows.append(list(h + h[::-1]))
    for (x, y, s) in [(16,27,'oTttTo'), (17,28,'oooo'), (8,32,'SSS')]:
        for i, ch in enumerate(s): rows[y][x+i] = ch
    img = blank(); px = img.load()
    x0, y0, x1, y1 = 3, 14, 42, 49
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) or y in (y0, y1): px[x, y] = PAL['out']; continue
            i, j = x - x0 - 1, y - y0 - 1
            ch = rows[j][i]
            px[x, y] = burst(i, j) if ch == '.' else LP[ch]
    t = render("OOPS!", PAL['red'])
    img.alpha_composite(t, ((W - t.width)//2, 3))
    img.alpha_composite(t.rotate(180), ((W - t.width)//2, H - 3 - t.height))
    return img

# ------------------------------------------------------------------ icons
def icons():
    ks = king_card('S')
    face = ks.crop((4, 15, 42, 49))   # the portrait panel
    for size, k in ((192, 5), (512, 13)):
        ic = Image.new('RGBA', (size, size), (47,66,52,255))
        f = face.resize((face.width * k, face.height * k), Image.NEAREST)
        ic.alpha_composite(f, ((size - f.width)//2, (size - f.height)//2))
        ic.save(f'out/icons/icon-{size}.png')

if __name__ == '__main__':
    logo().save('out/ui/logo.png')
    card_outline(dashed=True).save('out/ui/slot_empty.png')
    for s in 'SHDC': foundation(s).save(f'out/ui/foundation_{s}.png')
    recycle().save('out/ui/stock_recycle.png')
    select_ring().save('out/ui/card_select.png')
    loss_card().save('out/ui/loss_card.png')
    icons()
    # preview: title over a mock table
    S = 3; FELT = (47,66,52,255)
    lg = logo(); tw = 7 * (W + 6) + 6
    prev = Image.new('RGBA', (tw, lg.height + 12 + H + 6 + H + 8), FELT)
    prev.alpha_composite(lg, ((tw - lg.width)//2, 4))
    y = lg.height + 12
    from PIL import Image as I
    top = [I.open('out/cards/back.png'), recycle(), None] + [foundation(s) for s in 'SHDC']
    for i, c in enumerate(top):
        if c: prev.alpha_composite(c, (6 + i*(W+6), y))
    y2 = y + H + 6
    row = [card_outline(dashed=True), loss_card(), I.open('out/cards/KH.png'), I.open('out/cards/QC.png')]
    for i, c in enumerate(row): prev.alpha_composite(c, (6 + i*(W+6), y2))
    sel = select_ring(); prev.alpha_composite(sel, (6 + 2*(W+6) - 2, y2 - 2))
    prev.resize((prev.width*S, prev.height*S), I.NEAREST).save('out/ui_preview_3x.png')
    loss_card().resize((W*8, H*8), I.NEAREST).save('out/loss_card_8x.png')
