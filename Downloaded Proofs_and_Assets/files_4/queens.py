"""Queens: pin-up figures. Poses built from capsules/ellipses/polygons rasterized at native res + auto outline."""
import sys, math; sys.path.insert(0, 'art_src')
from cards import *
from kings import bg_color
from PIL import Image

PW, PH = 38, 34   # portrait panel interior

class Pose:
    def __init__(self):
        self.px = {}          # (x,y) -> rgb
    def _put(self, test, col, bbox):
        x0, y0, x1, y1 = bbox
        for y in range(max(0, int(y0) - 1), min(PH, int(y1) + 2)):
            for x in range(max(0, int(x0) - 1), min(PW, int(x1) + 2)):
                if test(x + .5, y + .5):
                    self.px[(x, y)] = col(x, y) if callable(col) else col
    def ell(self, cx, cy, rx, ry, col):
        self._put(lambda x, y: ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1, col, (cx-rx, cy-ry, cx+rx, cy+ry))
    def cap(self, a, b, r, col):
        (ax, ay), (bx, by) = a, b
        def t(x, y):
            dx, dy = bx-ax, by-ay; L = dx*dx + dy*dy or 1e-9
            u = max(0, min(1, ((x-ax)*dx + (y-ay)*dy) / L))
            return math.hypot(x - (ax + u*dx), y - (ay + u*dy)) <= r
        self._put(t, col, (min(ax,bx)-r, min(ay,by)-r, max(ax,bx)+r, max(ay,by)+r))
    def poly(self, pts, col):
        def t(x, y):
            c = False
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i+1) % len(pts)]
                if (y1 > y) != (y2 > y) and x < x1 + (y-y1)*(x2-x1)/(y2-y1): c = not c
            return c
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        self._put(t, col, (min(xs), min(ys), max(xs), max(ys)))
    def dot(self, x, y, col): self.px[(x, y)] = col
    def outline(self, col=(43,36,32)):
        edge = {}
        for (x, y) in self.px:
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                q = (x+dx, y+dy)
                if q not in self.px and 0 <= q[0] < PW and 0 <= q[1] < PH: edge[q] = col
        self.px.update(edge)

SKIN, SKIN_D = (236,190,158), (206,150,120)
LIPS, EYE = (178,40,40), (40,28,24)
RED, RED_D, WHITE = (170,44,40), (126,30,30), (244,238,226)
OLIVE, OLIVE_D, OLIVE_L = (92,100,62), (62,68,42), (122,130,86)
GOLD = (210,170,78)

# ---------------------------------------------------------------- Q♠ bomber nose art
def aluminum(x, y):
    if y < 2: return (150,154,156)
    if x in (12, 25) or y == 20:
        return (206,210,212) if (x + y) % 3 == 0 else (128,132,136)
    return (176,180,182) if (x - y) % 9 else (190,194,196)

def q_spades():
    p = Pose()
    HAIR = (92,52,36)
    p.ell(17, 28, 12.5, 3.8, lambda x, y: OLIVE_L if y < 27 else OLIVE)      # the bomb she's riding
    p.poly([(28.5,26),(35,23),(35,33),(28.5,30)], OLIVE_D)
    p.cap((11,24.5),(11,31.5), .6, GOLD)
    p.ell(16.5, 7.5, 3.8, 4, HAIR); p.ell(14.3, 11.5, 2, 2.6, HAIR)          # hair
    p.cap((15.5,13.5),(12,23.5), 1.3, SKIN)                                   # back arm braced
    p.cap((19,23),(26,25.5), 2.1, SKIN_D)                                     # back leg
    p.cap((26,25.5),(28.5,31.5), 1.5, SKIN_D); p.cap((28.5,31.5),(31,32.5), 1, RED_D)
    p.ell(18, 13.8, 3.6, 1.4, SKIN)                                           # bare shoulders
    p.cap((17.5,10),(18,13), 1.1, SKIN)                                       # neck
    p.cap((18,15),(19,20), 2.8, RED); p.ell(19.5, 22, 4, 2.4, RED)            # swimsuit
    p.cap((20.5,22),(28,20.5), 2.3, SKIN)                                     # front leg crossed over
    p.cap((28,20.5),(31.5,27.5), 1.6, SKIN); p.cap((31.5,27.5),(33.5,28.5), 1, RED)
    p.cap((21.5,14.5),(25.5,19.5), 1.2, SKIN)                                 # hand on her knee
    p.ell(17, 7.5, 2.6, 3, SKIN)                                              # face
    p.ell(14.5, 4.8, 1.9, 1.9, HAIR); p.ell(19.5, 4.6, 2.1, 1.7, HAIR)        # victory rolls
    p.outline()
    for q in [(16,7),(18,7)]: p.dot(*q, EYE)
    p.dot(17, 9, LIPS)
    for q in [(18,16),(20,18),(17,19),(21,22),(18,22)]: p.dot(*q, WHITE)       # polka dots
    return p, aluminum, [(3,1,'b'),(7,1,'b'),(11,1,'b')]

# ---------------------------------------------------------------- Q♣ mudflap girl
def rubber(x, y):
    if y < 3: return (196,196,190) if y == 1 else (132,132,128)
    if (x, y) in [(2,5),(35,5),(2,31),(35,31)]: return (214,214,208)
    return (46,44,42) if (x * 5 + y * 3) % 11 else (54,52,50)

def q_clubs():
    p = Pose(); C = (184,188,196)
    p.ell(11, 7, 2.3, 2.6, C)                                                 # head, profile facing right
    p.cap((11,6.5),(14,7.5), .6, C)                                           # nose/brow line
    p.cap((12,9),(14.5,9.3), .5, C)                                           # chin
    p.poly([(10,4.3),(8.2,5.5),(7.4,10),(8,14.5),(9.8,15),(10.4,11),(11.2,9)], C)  # long hair down her back
    p.cap((12,9.5),(13.2,12), .8, C)                                          # neck
    p.cap((13.2,12.5),(12.5,21.5), 2.0, C)                                    # arched back
    p.ell(15.8, 14.6, 1.8, 1.6, C)                                            # bust
    p.cap((11.8,13),(6.5,22.5), .8, C); p.cap((6.5,22.5),(5,24.5), .7, C)     # arm propping her up
    p.ell(12.3, 23.4, 3.9, 2.5, C)                                              # hips
    p.cap((14,24.5),(23,24.8), 1.5, C)                                        # leg stretched out
    p.cap((23,24.8),(30.5,26.5), 1.1, C); p.cap((30.5,26.5),(33.5,26.8), .7, C)
    p.cap((13,22),(20.5,13.5), 1.7, C)                                        # knee up
    p.cap((20.5,13.5),(25,22.5), 1.1, C); p.cap((25,22.5),(28,23.2), .7, C)
    p.cap((14.5,15),(19,17.5), .6, C)                                         # hand resting toward the knee
    p.px = {(x, y+2): c for (x, y), c in p.px.items() if y + 2 < PH}
    fig = set(p.px)
    for (x, y) in fig:
        if (x, y-1) not in fig: p.px[(x, y)] = (240,240,236)                  # chrome catches light on top edges
        elif (x, y+1) not in fig: p.px[(x, y)] = (126,130,138)
    p.outline((22,22,22))
    return p, rubber, []

# ---------------------------------------------------------------- Q♦ lady deputy
TAN, TAN_D = (170,132,88), (126,94,60)
BRN, BRN_D = (104,78,54), (76,56,38)
AUBURN = (150,64,38)

def q_diamonds():
    p = Pose()
    p.ell(18, 11, 6, 6, AUBURN)                                   # big '80s hair
    p.ell(18, 15, 5.5, 3, AUBURN)
    p.poly([(12,16),(24,16),(22,26),(14,26)], BRN)                # uniform shirt
    p.poly([(14,26.5),(22,26.5),(24,34),(12.5,34)], BRN_D)        # trousers, hip cocked
    p.cap((13,16.5),(10,21), 1.5, BRN)                            # arm to hip
    p.cap((10,21),(14,24.5), 1.2, SKIN)
    p.cap((23,16.5),(25,22), 1.5, BRN)                            # other arm, keys
    p.cap((25,22),(25,27), 1.1, SKIN)
    p.cap((18,12.5),(18,15.5), 1.3, SKIN)                         # neck
    p.poly([(16.5,15.5),(19.5,15.5),(18,18.5)], SKIN)             # open collar
    p.ell(18, 9, 3.4, 4, SKIN)                                    # face
    p.ell(18, 5.2, 7, 1.4, TAN)                                   # campaign hat brim
    p.poly([(13.5,5),(15,1),(21,1),(22.5,5)], TAN)                # crown
    p.cap((14,4.3),(22,4.3), .5, (70,48,34))                      # band
    p.outline()
    for x in range(14, 23): p.dot(x, 25, (40,36,32))              # duty belt
    p.dot(18, 25, GOLD)
    for q in [(20,19),(19,20),(20,20),(21,20),(20,21)]: p.dot(*q, GOLD)   # star
    for q in [(24,28),(25,29),(26,28)]: p.dot(*q, GOLD)                   # key ring
    for q in [(14,11),(22,11)]: p.dot(*q, GOLD)                           # earrings
    for q in [(16,9),(20,9)]: p.dot(*q, EYE)
    p.dot(16,8, AUBURN); p.dot(20,8, AUBURN)                              # arched brows
    p.dot(17,12, LIPS); p.dot(18,12, LIPS); p.dot(19,11, LIPS)            # the smirk
    return p, lambda x, y: bg_color('jail', x, y), []

# ---------------------------------------------------------------- Q♥ '80s action heroine
BLONDE, BLONDE_D = (226,190,110), (184,146,76)
KHAKI = (206,190,150)

def q_hearts():
    p = Pose()
    p.ell(18, 8, 5.5, 5.5, BLONDE)                                # feathered volume
    p.ell(15, 13, 2.5, 3.5, BLONDE_D); p.ell(21, 13, 2.5, 3.5, BLONDE_D)
    p.cap((16,24),(12,33.5), 2.3, OLIVE)                          # cargo pants, wide stance
    p.cap((20,24),(24.5,33.5), 2.3, OLIVE)
    p.poly([(14,23),(22,23),(22.5,26.5),(13.5,26.5)], OLIVE)
    p.poly([(14,13),(22,13),(21,19.5),(15,19.5)], (48,46,44))          # tied-up tank
    p.poly([(15,19.5),(21,19.5),(21.5,23),(14.5,23)], SKIN)       # midriff
    p.cap((14.5,13.5),(12.5,19), 1.4, SKIN)                       # arms
    p.cap((21.5,13.5),(24,18), 1.4, SKIN)
    p.cap((18,11),(18,13.5), 1.1, SKIN)
    p.ell(18, 8, 3, 3.6, SKIN)                                    # face
    p.ell(18, 4.8, 3.6, 1.6, BLONDE)                              # bangs
    p.cap((9,27),(28,8), .9, (118,120,126))                          # rifle at port arms
    p.cap((9,27),(11.5,24.5), 1.5, (96,66,40))                    # stock
    p.cap((12.5,19),(14.5,22), 1.2, SKIN)                         # hands over the rifle
    p.cap((24,18),(22.5,15), 1.2, SKIN)
    p.outline()
    for x in range(14, 23): p.dot(x, 23, (70,50,34))              # belt
    for q in [(16,8),(20,8)]: p.dot(*q, EYE)
    p.dot(18,10, LIPS); p.dot(19,10, LIPS)
    p.dot(18,19,(48,46,44)); p.dot(17,20,(48,46,44)); p.dot(19,20,(48,46,44))  # the knot
    return p, lambda x, y: bg_color('boom', x, y), []

QUEENS = {'S': q_spades, 'C': q_clubs, 'D': q_diamonds, 'H': q_hearts}

def mission_bomb(px, x, y):   # tiny bomb tally marks painted on the fuselage
    for i, col in enumerate([(62,68,42,255)]*2 + [(43,36,32,255)]): px[x+i, y] = col

def queen_card(suit):
    pose, bg, extras = QUEENS[suit]()
    img = blank(); px = img.load()
    x0, y0, x1, y1 = 3, 14, 42, 49
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) or y in (y0, y1): px[x, y] = PAL['out']; continue
            i, j = x - x0 - 1, y - y0 - 1
            c = pose.px.get((i, j))
            px[x, y] = (c + (255,)) if c else (bg(i, j) if len(bg(i, j)) == 4 else bg(i, j) + (255,))
    for (bx, by, _) in extras: mission_bomb(px, x0 + 1 + bx, y0 + 1 + by)
    col = PAL['red'] if suit in 'HD' else PAL['blk']
    index_block(img, 'Q', suit, col, 3, 3)
    index_block(img, 'Q', suit, col, W-4, H-4, flip=True)
    return img

if __name__ == '__main__':
    from kings import king_card
    from jacks import jack_card
    S = 3; FELT = (47,66,52,255)
    qs = [queen_card(s) for s in 'SCDH']
    for s, c in zip('SCDH', qs): c.save(f'out/cards/Q{s}.png')
    big = Image.new('RGBA', (4*(W+4)*8 + 4*8, (H+8)*8), FELT)
    for i, c in enumerate(qs):
        big.alpha_composite(c.resize((W*8, H*8), Image.NEAREST), (4*8 + i*(W+4)*8, 4*8))
    big.save('out/queens_8x.png')
    real = Image.new('RGBA', (4*(W+6)*S + 6*S, 3*(H+6)*S + 6*S), FELT)
    for i, s in enumerate('SCDH'):
        for r, fn in enumerate([jack_card, queen_card, king_card]):
            real.alpha_composite(fn(s).resize((W*S, H*S), Image.NEAREST), (6*S + i*(W+6)*S, 6*S + r*(H+6)*S))
    real.save('out/court_actual_size.png')
