# Generates the blnqr dot cards for subitizing: dice patterns and scattered dots
# for 1-6, and ten-frames for 1-10. Same 200x200 flat style as the animals.
# Run from the blnqr folder:  python pictures/make_dots.py
import os, random, math

OUT = os.path.join(os.path.dirname(__file__), 'dots')
O = '#1e1b2e'
COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']
BACKS = ['#fef3c7', '#e0f2fe', '#dcfce7', '#fce7f3', '#ede9fe', '#ffedd5']


def card(back, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
            f'<rect x="8" y="8" width="184" height="184" rx="28" fill="{back}" stroke="{O}" stroke-width="6"/>'
            f'<g stroke="{O}" stroke-width="5">{body}</g></svg>')


def dot(x, y, color, r=17):
    return (f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{color}"/>'
            f'<circle cx="{x - r * 0.35:.0f}" cy="{y - r * 0.35:.0f}" r="{r * 0.28:.1f}" fill="#fff" stroke="none" opacity=".75"/>')


DICE = {
    1: [(100, 100)],
    2: [(60, 60), (140, 140)],
    3: [(55, 55), (100, 100), (145, 145)],
    4: [(60, 60), (140, 60), (60, 140), (140, 140)],
    5: [(55, 55), (145, 55), (100, 100), (55, 145), (145, 145)],
    6: [(65, 52), (135, 52), (65, 100), (135, 100), (65, 148), (135, 148)],
}


def scatter(n, seed):
    rnd = random.Random(seed)
    for _ in range(2000):
        pts = []
        while len(pts) < n:
            p = (rnd.uniform(42, 158), rnd.uniform(42, 158))
            if all(math.dist(p, q) > 46 for q in pts):
                pts.append(p)
            elif len(pts) and rnd.random() < 0.02:
                break
        if len(pts) == n:
            return pts
    raise RuntimeError('could not place dots')


def ten_frame(n, color):
    x0, y0, w, h = 22, 58, 156 / 5, 42
    cells = ''.join(f'<rect x="{x0 + c * w:.1f}" y="{y0 + r * h}" width="{w:.1f}" height="{h}" fill="#fff" stroke-width="4"/>'
                    for r in range(2) for c in range(5))
    dots = ''.join(dot(x0 + (i % 5) * w + w / 2, y0 + (i // 5) * h + h / 2, color, 13) for i in range(n))
    return cells + dots


os.makedirs(OUT, exist_ok=True)
pics = {}
k = 0
for n in range(1, 7):
    for style in ('dice', 'scatter a', 'scatter b'):
        pts = DICE[n] if style == 'dice' else scatter(n, f'{n}{style}')
        color = COLORS[k % len(COLORS)]
        pics[f'dots {n} {style}'] = card(BACKS[k % len(BACKS)], ''.join(dot(x, y, color) for x, y in pts))
        k += 1
for n in range(1, 11):
    pics[f'ten frame {n}'] = card(BACKS[n % len(BACKS)], ten_frame(n, COLORS[n % len(COLORS)]))

for name, svg in pics.items():
    with open(os.path.join(OUT, name.replace(' ', '-') + '.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
print(len(pics), 'dot cards written')
