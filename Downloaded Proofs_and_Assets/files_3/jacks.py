"""Jack John x4: young John, no glasses, droopy puppy-dog brown eyes, dark brown stache. Same worlds, lower rank."""
import sys; sys.path.insert(0, 'art_src')
from cards import *
from kings import bg_color
from PIL import Image

JP = {
 'o': (43,36,32), 's': (222,170,132), 'd': (190,134,102), 'h': (240,198,162),
 'N': (74,50,34), 'n': (48,32,22),                    # dark brown brows + stache
 'e': (40,28,22), 'E': (92,58,34), 'w': (240,232,220),  # lids, brown iris, whites
 'm': (104,56,44), 'b': (40,36,32), 'y': (210,170,78), 'k': (196,178,132),
 'c': (92,100,62), 'C': (62,68,42), 'U': (58,66,40), '3': (84,64,44),
 'z': (104,78,54), '2': (76,56,38), 'R': (150,72,48),
 'i': (84,84,78), 'I': (56,56,52), 'a': (224,212,186), 'A': (190,176,148),
 '5': (86,104,130), '6': (60,74,96), '7': (82,98,122), '8': (60,72,92),
 'H': (70,48,32), 'J': (108,76,52), 'V': (92,88,84), 'S': (200,204,208),
}
JP = {k: v + (255,) for k, v in JP.items()}

FACE = [  # rows 10-26, left halves
 ".........oHssNNNNss",  # 10 brow: inner end raised = puppy dog
 ".........oHNNssssss",  #    outer end lower
 ".......osdsssseeees",  # 12 upper lid
 ".......osdssewEEess",  #    outer corner droops below the lid line
 ".......osdsssdddsss",  #    soft lower lid
 ".......osdsssssssds",  # 15 nose bridge
 ".......osdsssssssds",
 ".......osdssssssdhh",  #    nose tip
 ".........osssssssdd",
 ".........ossssNNNNN",  #    stache (young, dark, full bar)
 ".........osssNNNNNN",  # 20
 ".........ossNNnnnnn",
 ".........ossssssssm",
 "..........osssssss",
 "...........osssssss"[:19],
 "............oddssss",  # 25
 ".............oooooo",
]
FACE[13] = "..........ossssssss"

HATS = {
'cadet': [  # woodland BDU patrol cap
 "...................",
 "...................",
 "...................",
 ".........oooooooooo",
 "........o&&&&&&&&&&",
 "........o&&&&&&&&&&",
 "........o&&&&&&&&&&",
 "........oCCCCCCCCCC",
 ".......o&&&&&&&&&&&",
 "........ooooooooooo"],
'deputy': [  # brown duty ball cap, gold star
 "...................",
 "...................",
 "...................",
 "...........oooooooo",
 ".........oozzzzzzzz",
 "........ozzzzzzzzzz",
 "........ozzzzzzzzzz",
 "........o2222222222",
 ".......ozzzzzzzzzzz",
 "........oo222222222"],
'rookie': [  # denim-blue mesh cap, white foam patch
 ".............oooooo",
 "...........oo555555",
 ".........o555555555",
 "........oIi55555aaa",
 "........oiI5555aaRa",
 "........oIi5555aaaa",
 "........oiI66666666",
 "........o5555555555",
 ".......o55555555555",
 "........oo666666666"],
'young': [  # '80s feathered hair, no bandana
 "...................",
 "...........oooooooo",
 ".........ooHHHHHHHH",
 "........oHHHHHHHHHH",
 "........oHHJHHHHHHH",
 "........oHHHJJHHHHH",
 "........oHHHHHHHsss",
 "........oHHHHHssss s".replace(' ', ''),
 "........oHHHsssssss",
 "........oHHssssssss"],
}

UNIFORM = [
 "..............odddd",
 ".......oooooooodddd",
 ".....ouuuuuuuukkkbb",
 "....ouuuuuuuuuUkkbb",
 "...ouuuuuuuuuuuUkbb",
 "...ouuuuuuuuuuuuUbb",
 "..ouuuuuuuuuuuuuUbb",
]
TORSOS = {
'cadet':  [r.translate(str.maketrans('ukb', '&U3')) for r in UNIFORM],
'deputy': [r.translate(str.maketrans('uUk', 'z2z')) for r in UNIFORM],
'rookie': [  # denim jacket with the sherpa collar
 "..............odddd",
 ".......ooaaaaaadddd",
 ".....o777777aaaaIII",
 "....o77777777aaaIII",
 "...o777777777777aII",
 "...o7777777777777II",
 "..o77777777777777II"],
'young': [  # leather jacket, collar popped, white tee, dog tag
 "..............odddd",
 ".......obbbbbbbdddd",
 ".....obbVbbbbbbaaaa",
 "....obbbbbbbbbbaaaa",
 "...obVbbbbbbbbbbaaa",
 "...obbbbbbbbbbbbaaa",
 "..obbbbbbbbbbbbbbaa"],
}

OVERRIDES = {
 'cadet':  [(18,5,'bb'), (17,6,'b'), (20,6,'b'), (16,7,'b'), (21,7,'b'),   # private's chevron
            (22,32,'kkkk'), (10,32,'kkkk')],                              # name + US ARMY tapes
 'deputy': [(18,4,'yy'), (17,5,'yyyy'), (17,6,'y'), (20,6,'y'),           # cap star
            (24,30,'y'), (23,31,'yyy'), (23,32,'y'), (25,32,'y'),
            (10,32,'bwwb'), (6,30,'bb'), (7,31,'b')],                     # name tag, shoulder radio
 'rookie': [(10,32,'8888'), (24,32,'8888')],                              # jacket pockets
 'young':  [(18,32,'SS')] + [(7,y,'HH') for y in range(17,26)] + [(29,y,'HH') for y in range(17,26)],
}
COMMON = [(20,22,'m')]

def camo(x, y):
    cell = ((x // 3) * 7 + (y // 2) * 13 + ((x + y) // 4) * 5 + (x * y) % 3) % 5
    return [(92,100,62,255), (74,82,50,255), (112,92,62,255), (40,38,32,255), (92,100,62,255)][cell]

JACKS = {'S': ('cadet', 'berlin'), 'C': ('rookie', 'grille'),
         'D': ('deputy', 'jail'),  'H': ('young', 'boom')}

def build(name):
    rows = []
    for h in HATS[name] + FACE + TORSOS[name]:
        assert len(h) == 19, (name, len(h), h)
        rows.append(list(h + h[::-1]))
    for (x, y, s) in COMMON + OVERRIDES[name]:
        for i, ch in enumerate(s): rows[y][x+i] = ch
    return rows

def jack_card(suit):
    name, mode = JACKS[suit]
    rows = build(name)
    img = blank(); px = img.load()
    x0, y0, x1, y1 = 3, 14, 42, 49
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) or y in (y0, y1): px[x, y] = PAL['out']; continue
            j, i = y - y0 - 1, x - x0 - 1
            ch = rows[j][i]
            px[x, y] = bg_color(mode, i, j) if ch == '.' else camo(i, j) if ch == '&' else JP[ch]
    col = PAL['red'] if suit in 'HD' else PAL['blk']
    index_block(img, 'J', suit, col, 3, 3)
    index_block(img, 'J', suit, col, W-4, H-4, flip=True)
    return img

if __name__ == '__main__':
    from kings import king_card
    S = 3; FELT = (47,66,52,255)
    jacks = [jack_card(s) for s in 'SCDH']
    for s, c in zip('SCDH', jacks): c.save(f'out/cards/J{s}.png')
    big = Image.new('RGBA', (4*(W+4)*8 + 4*8, (H+8)*8), FELT)
    for i, c in enumerate(jacks):
        big.alpha_composite(c.resize((W*8, H*8), Image.NEAREST), (4*8 + i*(W+4)*8, 4*8))
    big.save('out/jacks_8x.png')
    real = Image.new('RGBA', (4*(W+6)*S + 6*S, 2*(H+6)*S + 6*S), FELT)
    for i, s in enumerate('SCDH'):
        real.alpha_composite(jack_card(s).resize((W*S, H*S), Image.NEAREST), (6*S + i*(W+6)*S, 6*S))
        real.alpha_composite(king_card(s).resize((W*S, H*S), Image.NEAREST), (6*S + i*(W+6)*S, (H+12)*S))
    real.save('out/jacks_and_kings_actual_size.png')
