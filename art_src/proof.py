from PIL import Image, ImageDraw
import sys; sys.path.insert(0, 'art_src')
from cards import *
S = 3
FELT = (47, 66, 52, 255)
def up(img): return img.resize((img.width*S, img.height*S), Image.NEAREST)
cols, gap = 11, 6
sheet = Image.new('RGBA', ((W+gap)*cols*S + gap*S, (H+gap)*4*S + 170*S//1 ), FELT)
ranks = ['A','2','3','4','5','6','7','8','9','10']
for j, s in enumerate('SHDC'):
    for i, r in enumerate(ranks):
        sheet.alpha_composite(up(number_card(r, s)), ((gap + i*(W+gap))*S, (gap + j*(H+gap))*S))
    if j == 0:
        sheet.alpha_composite(up(card_back()), ((gap + 10*(W+gap))*S, gap*S))
# tableau overlap test: face-down stack then a descending face-up run, 14px native reveal
y0 = (gap + 4*(H+gap))*S
x = gap*S
run = [('10','S'),('9','H'),('8','C'),('7','D'),('6','S'),('5','H')]
yy = y0
for k in range(3):
    sheet.alpha_composite(up(card_back()), (x, yy)); yy += 5*S
for r, s in run:
    sheet.alpha_composite(up(number_card(r, s)), (x, yy)); yy += 14*S
run2 = [('9','C'),('8','D'),('6','C'),('9','D'),('8','S'),('6','H')]
x2 = x + (W+gap)*S; yy = y0
for r, s in run2:
    sheet.alpha_composite(up(number_card(r, s)), (x2, yy)); yy += 14*S
sheet = sheet.crop((0,0,sheet.width, max(yy, y0) + H*S + gap*S))
sheet.save('out/proof_sheet_3x.png')
print(sheet.size)
