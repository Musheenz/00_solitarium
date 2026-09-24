"""King John x4. One shared face (same actor), four costumes (hat rows 0-9, torso rows 27-33), four backdrops."""
import sys, math; sys.path.insert(0, 'art_src')
from cards import *
from PIL import Image

KP = {
 'o': (43,36,32), 's': (218,166,134), 'd': (184,128,100), 'h': (236,192,160),
 # peppered gray: darker than v1 so the stache and goatee read as separate shapes at distance
 'g': (138,134,128), 'G': (96,92,88), 'P': (178,174,166),
 # dark aviators
 'f': (150,116,64), 'L': (34,38,46), 'M': (64,74,90), 'W': (146,162,178), 'w': (250,248,240),
 'm': (100,54,44), 'b': (40,36,32), 'y': (210,170,78),
 # colonel
 'c': (92,100,62), 'C': (62,68,42), 'v': (34,31,29), 'V': (96,92,86),
 'u': (78,88,56), 'U': (58,66,40), 'k': (196,178,132), 'S': (200,204,208),
 'r': (158,43,38), 'n': (52,62,96),
 # sheriff
 't': (170,132,88), 'T': (126,94,60), 'x': (200,164,114), 'B': (70,48,34),
 'z': (104,78,54), '2': (76,56,38),
 # trucker
 'a': (224,212,186), 'A': (190,176,148), 'i': (84,84,78), 'I': (56,56,52),
 'R': (150,72,48), 'K': (100,46,34),
 # action
 'H': (176,172,164), 'j': (104,30,28), 'O': (96,66,40),
}
KP = {k: v + (255,) for k, v in KP.items()}

FACE = [  # rows 10-26, left halves (col 18|19 is the center line)
 ".........odsGGGssss",  # 10 brow peak toward the outside
 ".........odGsssGGGs",  #    inner end slopes down: determined, not angry
 ".......osdsffffffff",  # 12 top bar + bridge joins the lenses
 ".......osdsfLLMWwfs",  #    sheen runs diagonally: light on the lens curve
 ".......osdsfLMWLLfs",
 ".......osdsfMWLLLfd",
 ".......osdsfLLLLffd",  # 16 teardrop: inner corner lifts
 ".......osdssffffssd",
 ".........odsssssdhh",  # 18 nose tip
 ".........odsssggggg",  #    stache
 ".........odssgggPgg",  # 20
 ".........odsggGGGGG",
 ".........odsggssssm",  #    mouth under the stache, horseshoe sides
 "..........odgGsssss",
 "...........odsssssd",  #    skin gap separates stache from goatee
 "............oddssGg",  # 25 goatee
 ".............oooooo",
]

HATS = {
'colonel': [
 "..........ooooooooo",
 "........ooccccccccc",
 ".......occccccccccc",
 "......occcccccccccy",
 "......occcccccccyyy",
 "......oCCCCCCCCCCyy",
 "......oCCCCCCCCCCCC",
 "......ovyyyyyyyyyyy",
 "......ovvvVVVvvvvvv",
 "........ooooooooooo"],
'trucker': [
 "...........oooooooo",
 ".........ooaaaaaaaa",
 "........oIiaaaaaaaa",
 "........oiIaaaaaRRR",
 "........oIiaaaaaRyR",
 "........oiIaaaaaRRR",
 "........oIiAAAAAAAA",
 "........oRRRRRRRRRR",
 ".......oRRRRRRRRRRR",
 "........ooKKKKKKKKK"],
'sheriff': [
 "..........ooooo....",
 ".........oxxxxxoooo",
 ".........oxtttttttt",
 ".........ottttttttt",
 ".........ottttttttt",
 ".........oBBBBBBBBB",
 "..oo.....ottttttttt",
 ".oxxxxxxxxttttttttt",
 ".oTTTTTTTTTTTTTTTTT",
 "..ooooooooooooooooo"],
'action': [
 "...................",
 "............ooooooo",
 "..........oohhhhhhh",
 ".........oHsssshhhh",
 ".........oHssssssss",
 ".........orrrrrrrrr",
 ".........orrwrrrrwr",
 ".........ojjjjjjjjj",
 ".........odsssssss s".replace(' ', ''),
 ".........odssssssss"],
}

UNIFORM = [
 "..............odddd",
 ".......oooooooodddd",
 ".....ouuuuuuuukkkbb",
 "....ouuuuuuuuuUkkbb",
 "...ouSSuuuuuuuuUkbb",
 "...ouuuuuuuuuuuuUbb",
 "..ouuuuuuuuuuuuuUbb",
]
TORSOS = {
'colonel': UNIFORM,
'sheriff': [r.translate(str.maketrans('uUkS', 'z2tR')) for r in UNIFORM],
'trucker': [
 "..............odddd",
 ".......ooooooo%%aaa",
 ".....o%%%%%%%%%%aaa",
 "....o%%%%%%%%%%%%aa",
 "...o%%%%%%%%%%%%%%a",
 "...o%%%%%%%%%%%%%%%",
 "..o%%%%%%%%%%%%%%%%"],
'action': [
 "..............odddd",
 ".......ooooooosdddd",
 ".....osssssssuuuuuu",
 "....ossssssssuuuuuu",
 "...osssssssssuuuuuu",
 "...ossssssssduuuuuu",
 "..osssssssssduuuuuu"],
}

OVERRIDES = {
 'colonel': [(22,31,'rnyr'), (22,32,'nyrn'), (10,32,'bwwb')],
 'sheriff': [(24,30,'y'), (23,31,'yyy'), (23,32,'y'), (25,32,'y'), (10,32,'bwwb'), (4,31,'yy')],
 'trucker': [],
 'action':  [(28,5,'orr'), (28,6,'orrrr'), (29,7,'ojrrrr'), (32,8,'rrjr'), (34,9,'rrj'), (35,10,'j'),
             (9,29,'OyO'), (12,30,'OyO'), (15,31,'OyO'), (18,32,'OyO'), (21,33,'OyO')],
}
COMMON = [(20,22,'m')]  # the smirk

def build(name):
    halves = HATS[name] + FACE + TORSOS[name]
    rows = []
    for h in halves:
        assert len(h) == 19, (name, len(h), h)
        rows.append(list(h + h[::-1]))
    for (x, y, s) in COMMON + OVERRIDES[name]:
        for i, ch in enumerate(s): rows[y][x+i] = ch
    return rows

def bg_color(mode, x, y):
    if mode == 'berlin':
        if y < 17: return (104,116,122,255)
        if y == 17: return (178,176,168,255)
        return (126,124,118,255) if x % 12 == 5 else (150,148,140,255)
    if mode == 'grille':   # standing in front of his rig's chrome
        if y < 3: return (120,110,100,255)
        return [(112,112,108,255), (188,186,178,255), (156,154,148,255)][x % 3]
    if mode == 'jail':
        return {1:(56,56,54,255), 2:(118,118,112,255)}.get(x % 6, (148,156,136,255))
    if mode == 'boom':     # '80s VHS cover explosion
        d = math.hypot(x - 18.5, (y - 40) * 1.1)
        dither = (x + y) % 2
        if d < 14 + dither: return (228,180,86,255)
        if d < 22 + dither: return (198,112,52,255)
        if d < 29 + dither: return (132,62,44,255)
        return (70,46,52,255)

def plaid(x, y):
    if x % 4 == 0 and y % 3 == 0: return (64,28,24,255)
    if x % 4 == 0 or y % 3 == 0: return (96,42,34,255)
    return (140,64,50,255)

KINGS = {'S': ('colonel', 'berlin'), 'C': ('trucker', 'grille'),
         'D': ('sheriff', 'jail'),   'H': ('action', 'boom')}

def king_card(suit):
    name, mode = KINGS[suit]
    rows = build(name)
    img = blank(); px = img.load()
    x0, y0, x1, y1 = 3, 14, 42, 49
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) or y in (y0, y1): px[x, y] = PAL['out']; continue
            j, i = y - y0 - 1, x - x0 - 1
            ch = rows[j][i]
            px[x, y] = bg_color(mode, i, j) if ch == '.' else plaid(i, j) if ch == '%' else KP[ch]
    col = PAL['red'] if suit in 'HD' else PAL['blk']
    index_block(img, 'K', suit, col, 3, 3)
    index_block(img, 'K', suit, col, W-4, H-4, flip=True)
    return img

if __name__ == '__main__':
    S = 3; FELT = (47,66,52,255)
    kings = [king_card(s) for s in 'SCDH']
    for s, k in zip('SCDH', kings): k.save(f'out/cards/K{s}.png')
    big = Image.new('RGBA', (4*(W+4)*8 + 4*8, (H+8)*8), FELT)
    for i, k in enumerate(kings):
        big.alpha_composite(k.resize((W*8, H*8), Image.NEAREST), (4*8 + i*(W+4)*8, 4*8))
    big.save('out/kings_8x.png')
    real = Image.new('RGBA', (4*(W+6)*S + 6*S, (H+12)*S), FELT)
    for i, k in enumerate(kings):
        real.alpha_composite(k.resize((W*S, H*S), Image.NEAREST), (6*S + i*(W+6)*S, 6*S))
    real.save('out/kings_actual_size.png')
