"""Face cards: portraits authored as left-half grids (mirrored), then asymmetric overrides."""
import sys; sys.path.insert(0, 'art_src')
from cards import *
from PIL import Image

FP = {  # portrait palette
 'p': (104,116,122,255), 'o': (43,36,32,255),
 'c': (92,100,62,255), 'C': (62,68,42,255), 'y': (210,170,78,255),
 'v': (34,31,29,255), 'V': (96,92,86,255),
 's': (218,166,134,255), 'd': (184,128,100,255), 'h': (236,192,160,255),
 'G': (150,146,140,255), 'g': (200,196,188,255),
 'f': (132,98,60,255), 'l': (228,200,176,255), 'e': (46,34,28,255), 'w': (250,246,236,255),
 'm': (104,56,46,255), 'k': (196,178,132,255), 'b': (40,36,32,255),
 'u': (78,88,56,255), 'U': (58,66,40,255), 'S': (200,204,208,255),
 'r': (158,43,38,255), 'n': (52,62,96,255),
}

def mirror(halves):
    rows = []
    for h in halves:
        assert len(h) == 19, (len(h), h)
        rows.append(h + h[::-1])
    return rows

def override(rows, edits):
    rows = [list(r) for r in rows]
    for (x, y, s) in edits:
        for i, ch in enumerate(s): rows[y][x + i] = ch
    return [''.join(r) for r in rows]

COLONEL = mirror([
 "..........ooooooooo",  # 0 cap crown
 "........ooccccccccc",
 ".......occccccccccc",
 "......occcccccccccy",
 "......occcccccccyyy",
 "......oCCCCCCCCCCyy",
 "......oCCCCCCCCCCCC",  # band
 "......ovyyyyyyyyyyy",  # gold oak leaves on visor
 "......ovvvVVVvvvvvv",
 "........ooooooooooo",
 ".........odGGGGGddd",  # 10 brows in visor shadow
 ".........osfffffffs",
 ".......osdsflllllfs",
 ".......osdsflleelfs",
 ".......osdsflllllfs",
 ".......osdsfflllffd",
 ".......osdssffffssd",
 ".......osddssssssdh",
 ".........odssssdddd",
 ".........odssgggggg",
 ".........odsgggggggg"[:19],  # 20 horseshoe
 ".........odsggGGGGG",
 ".........odsggssssm",
 "..........odggsssss",
 "...........odgsssgg",
 "............oddsggg",
 ".............oooooo",
 "..............odddd",
 ".......oooooooodddd",
 ".....ouuuuuuuukkkbb",
 "....ouuuuuuuuuUkkbb",  # 30
 "...ouSSuuuuuuuuUkbb",
 "...ouuuuuuuuuuuuUbb",
 "..ouuuuuuuuuuuuuUbb",
])
COLONEL = override(COLONEL, [
 (12, 12, 'w'), (21, 12, 'w'),          # lens glints
 (20, 22, 'm'), (21, 22, 'd'), (21, 21, 'G'),          # smirk: one corner of the mouth up
 (22, 31, 'rnyr'), (22, 32, 'nyrn'),    # ribbon rack
 (10, 32, 'bwwb'),                      # name tag
])
# Berlin Wall behind him: concrete below the rounded cap line, a little graffiti
WALL_TOP = 17
def wallify(rows):
    out = []
    for y, r in enumerate(rows):
        r = list(r)
        for x, ch in enumerate(r):
            if ch == '.':
                if y == WALL_TOP: r[x] = 'Q'
                elif y > WALL_TOP: r[x] = 'q' if x % 12 != 5 else 'Z'
        out.append(''.join(r))
    return out
COLONEL = override(wallify(COLONEL), [
 (0, 20, 'rr'), (1, 21, 'r'), (2, 22, 'yy'), (33, 21, 'n'), (34, 20, 'nn'), (35, 22, 'y'),
])
FP.update({'q': (150,148,140,255), 'Q': (178,176,168,255), 'Z': (126,124,118,255)})

def face_card(rank, suit, portrait, bg='p'):
    img = blank()
    px = img.load()
    col = PAL['red'] if suit in 'HD' else PAL['blk']
    # frame
    x0, y0, x1, y1 = 3, 14, 42, 49
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            px[x, y] = PAL['out'] if x in (x0, x1) or y in (y0, y1) else FP[bg]
    for j, row in enumerate(portrait[: y1 - y0 - 1]):
        for i, ch in enumerate(row):
            if ch != '.': px[x0 + 1 + i, y0 + 1 + j] = FP[ch]
    index_block(img, rank, suit, col, 3, 3)
    index_block(img, rank, suit, col, W-4, H-4, flip=True)
    return img

if __name__ == '__main__':
    k = face_card('K', 'S', COLONEL)
    k.save('out/cards/KS.png')
    k.resize((W*3, H*3), Image.NEAREST).save('out/KS_3x.png')
    k.resize((W*10, H*10), Image.NEAREST).save('out/KS_10x.png')
