"""John's Solitaire - pixel card generator. Art as data -> PNG.
Native card size W x H; the game draws at integer scale (3x on a 1366x768 Chromebook)."""
from PIL import Image
import os

W, H = 46, 64
PAL = {
    'out':   (43, 36, 32, 255),    # card outline, warm near-black
    'face':  (238, 228, 206, 255), # aged card stock
    'edge':  (214, 199, 170, 255), # inner bevel
    'red':   (158, 43, 38, 255),   # brick red
    'blk':   (36, 33, 30, 255),    # ink black
    'od':    (74, 83, 52, 255),    # olive drab
    'odd':   (52, 59, 37, 255),    # olive drab dark
    'odl':   (104, 114, 74, 255),  # olive drab light
    'khk':   (205, 190, 150, 255), # khaki
}

def grid(s):
    return [r for r in s.strip('\n').split('\n')]

GLYPHS = {k: grid(v) for k, v in {
'A': """
..##..
.####.
##..##
##..##
##..##
######
######
##..##
##..##
##..##""",
'2': """
.####.
######
##..##
....##
...###
..###.
.###..
###...
######
######""",
'3': """
#####.
######
....##
....##
.####.
.####.
....##
....##
######
#####.""",
'4': """
##..##
##..##
##..##
##..##
######
######
....##
....##
....##
....##""",
'5': """
######
######
##....
##....
#####.
######
....##
....##
######
#####.""",
'6': """
.####.
#####.
##....
##....
#####.
######
##..##
##..##
######
.####.""",
'7': """
######
######
....##
...##.
...##.
..##..
..##..
..##..
..##..
..##..""",
'8': """
.####.
######
##..##
##..##
.####.
######
##..##
##..##
######
.####.""",
'9': """
.####.
######
##..##
##..##
######
.#####
....##
....##
.#####
.####.""",
'0': """
.####.
######
##..##
##..##
##..##
##..##
##..##
##..##
######
.####.""",
'1': """
.##.
###.
.##.
.##.
.##.
.##.
.##.
.##.
####
####""",
'J': """
..####
..####
....##
....##
....##
....##
##..##
##..##
######
.####.""",
'Q': """
.####.
######
##..##
##..##
##..##
##..##
##.###
##..##
######
.###.#""",
'K': """
##..##
##..##
##.##.
####..
###...
###...
####..
##.##.
##..##
##..##""",
}.items()}

PIPS7 = {k: grid(v) for k, v in {
'H': """
.##.##.
#######
#######
#######
.#####.
..###..
...#...""",
'D': """
...#...
..###..
.#####.
#######
.#####.
..###..
...#...""",
'S': """
...#...
..###..
.#####.
#######
#######
...#...
..###..""",
'C': """
..###..
..###..
##.#.##
#######
##.#.##
...#...
..###..""",
}.items()}

PIPS9 = {k: grid(v) for k, v in {
'H': """
.###.###.
#########
#########
#########
#########
.#######.
..#####..
...###...
....#....""",
'D': """
....#....
...###...
..#####..
.#######.
#########
.#######.
..#####..
...###...
....#....""",
'S': """
....#....
...###...
..#####..
.#######.
#########
#########
.###.###.
....#....
...###...""",
'C': """
...###...
..#####..
..#####..
.##.#.##.
#########
#########
.##.#.##.
....#....
...###...""",
}.items()}

def stamp(img, g, x, y, col, flip=False):
    px = img.load()
    rows = g[::-1] if flip else g
    for j, row in enumerate(rows):
        r = row[::-1] if flip else row
        for i, ch in enumerate(r):
            if ch == '#':
                px[x + i, y + j] = col

def blank(fill='face'):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for y in range(H):
        for x in range(W):
            px[x, y] = PAL['out'] if x in (0, W-1) or y in (0, H-1) else PAL[fill]
    # rounded corners (2px)
    for cx, cy, dx, dy in [(0,0,1,1),(W-1,0,-1,1),(0,H-1,1,-1),(W-1,H-1,-1,-1)]:
        px[cx, cy] = (0,0,0,0); px[cx+dx, cy] = (0,0,0,0); px[cx, cy+dy] = (0,0,0,0)
        px[cx+dx, cy+dy] = PAL['out']
    return img

def rank_glyphs(rank):
    return [GLYPHS['1'], GLYPHS['0']] if rank == '10' else [GLYPHS[rank]]

def index_block(img, rank, suit, col, x, y, flip=False):
    """rank + small suit side by side, so a thin tableau overlap still shows both."""
    gs = rank_glyphs(rank)
    wid = sum(len(g[0]) for g in gs) + (len(gs) - 1)
    total = wid + 2 + 7
    if not flip:
        cx = x
        for g in gs:
            stamp(img, g, cx, y, col); cx += len(g[0]) + 1
        stamp(img, PIPS7[suit], x + wid + 2, y + 1, col)
    else:  # rotate 180 about the block, anchored at bottom-right (x,y)
        ox, oy = x - total + 1, y - 10 + 1
        stamp(img, PIPS7[suit], ox, oy + 2, col, flip=True)
        cx = ox + 7 + 2
        for g in reversed(gs):
            stamp(img, g, cx, oy, col, flip=True); cx += len(g[0]) + 1

# pip layouts in a 3-col grid; rows as fractions of the pip field
L, C, R = 0, 1, 2
LAYOUT = {
 '2': [(C,0),(C,1)],
 '3': [(C,0),(C,.5),(C,1)],
 '4': [(L,0),(R,0),(L,1),(R,1)],
 '5': [(L,0),(R,0),(C,.5),(L,1),(R,1)],
 '6': [(L,0),(R,0),(L,.5),(R,.5),(L,1),(R,1)],
 '7': [(L,0),(R,0),(C,.25),(L,.5),(R,.5),(L,1),(R,1)],
 '8': [(L,0),(R,0),(C,.25),(L,.5),(R,.5),(C,.75),(L,1),(R,1)],
 '9': [(L,0),(R,0),(L,1/3),(R,1/3),(C,.5),(L,2/3),(R,2/3),(L,1),(R,1)],
 '10':[(L,0),(R,0),(C,1/6),(L,1/3),(R,1/3),(L,2/3),(R,2/3),(C,5/6),(L,1),(R,1)],
}

def number_card(rank, suit, pipset=None):
    img = blank()
    col = PAL['red'] if suit in 'HD' else PAL['blk']
    index_block(img, rank, suit, col, 3, 3)
    index_block(img, rank, suit, col, W-4, H-4, flip=True)
    p = PIPS7[suit] if pipset is None else pipset[suit]; ps = len(p)
    colx = [10, (W - ps)//2, W - 10 - ps]
    top, bot = 15, H - 15 - ps
    if rank == 'A':
        big = scale_up(PIPS9[suit], 2)
        stamp(img, big, (W - len(big[0]))//2, (H - len(big))//2, col)
    else:
        for c, f in LAYOUT[rank]:
            y = round(top + f * (bot - top))
            stamp(img, p, colx[c], y, col, flip=f > .5)
    return img

def scale_up(g, k):
    return [''.join(ch * k for ch in row) for row in g for _ in range(k)]

def card_back():
    img = blank('od')
    px = img.load()
    # khaki frame, then a subtle diagonal weave
    for y in range(2, H-2):
        for x in range(2, W-2):
            if x in (2, W-3) or y in (2, H-3): px[x, y] = PAL['khk']
            elif (x + y) % 4 == 0 or (x - y) % 4 == 0: px[x, y] = PAL['odd']
    # stencil star in a ring, center
    import math
    cx, cy = W/2 - .5, H/2 - .5
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, y - cy)
            if 12 <= d < 14: px[x, y] = PAL['khk']
            elif d < 12: px[x, y] = PAL['od']
    star = []
    for i in range(10):
        a = -math.pi/2 + i * math.pi/5
        r = 10 if i % 2 == 0 else 4
        star.append((cx + r*math.cos(a), cy + r*math.sin(a)))
    def inside(pt, poly):
        x, y = pt; c = False; n = len(poly)
        for i in range(n):
            x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1)*(x2 - x1)/(y2 - y1): c = not c
        return c
    for y in range(H):
        for x in range(W):
            if inside((x, y), star): px[x, y] = PAL['khk']
    return img

if __name__ == '__main__':
    os.makedirs('out/cards', exist_ok=True)
    ranks = ['A','2','3','4','5','6','7','8','9','10']
    for s in 'SHDC':
        for r in ranks:
            number_card(r, s).save(f'out/cards/{r}{s}.png')
    card_back().save('out/cards/back.png')
