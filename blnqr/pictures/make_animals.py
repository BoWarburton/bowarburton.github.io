# Generates the blnqr animal picture library: flat vector SVGs, one shared style.
import os, sys

# Run from the blnqr folder: python pictures/make_animals.py pictures/animals
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "animals")
O = '#1e1b2e'  # outline


def svg(bg, body, extra_bg=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
            f'<defs><clipPath id="c"><circle cx="100" cy="100" r="96"/></clipPath></defs>'
            f'<circle cx="100" cy="100" r="96" fill="{bg}"/>{extra_bg}'
            f'<g clip-path="url(#c)" stroke="{O}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def eye(x, y, r=9, look=(2, 1)):
    dx, dy = look
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>'
            f'<circle cx="{x+dx}" cy="{y+dy}" r="{r*0.55:.1f}" fill="{O}" stroke="none"/>'
            f'<circle cx="{x+dx+r*0.2:.1f}" cy="{y+dy-r*0.25:.1f}" r="{r*0.2:.1f}" fill="#fff" stroke="none"/>')


def cheek(x, y, rx=7, ry=4.5):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#ff7aa2" opacity=".55" stroke="none"/>'


def smile(x, y, w=9, open_=False):
    if open_:
        return f'<path d="M{x-w},{y} Q{x},{y+w*1.3} {x+w},{y} Z" fill="#c2185b"/>'
    return f'<path d="M{x-w},{y} Q{x},{y+w*0.9} {x+w},{y}" fill="none"/>'


def limb(d, color, w=12):
    # A thick outlined stroke: dark outline underneath, color on top.
    return (f'<path d="{d}" fill="none" stroke="{O}" stroke-width="{w+10}"/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}"/>')


def shade(d):
    return f'<path d="{d}" fill="#000" opacity=".12" stroke="none"/>'


def motion(*lines):
    return ''.join(f'<path d="{d}" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/>' for d in lines)


A = {}

# ---------------- Mammals ----------------

A['elephant'] = svg('#ffe08a',
    # water spray
    '<g stroke="none" fill="#38bdf8"><circle cx="48" cy="34" r="6"/><circle cx="34" cy="46" r="5"/><circle cx="60" cy="26" r="4"/><circle cx="38" cy="28" r="4"/></g>'
    + limb('M128,150 L128,172', '#9aa5b8', 16) + limb('M150,148 L156,170', '#9aa5b8', 16)
    + '<ellipse cx="130" cy="128" rx="48" ry="34" fill="#9aa5b8"/>'
    + shade('M90,135 Q130,170 172,135 Q170,160 130,162 Q100,160 90,135 Z')
    + limb('M100,150 L92,170', '#9aa5b8', 16) + limb('M110,152 L108,172', '#9aa5b8', 16)
    + '<path d="M176,120 q14,4 12,18" fill="none"/>'
    + limb('M58,108 C40,118 34,90 36,50', '#9aa5b8', 14)
    + '<ellipse cx="96" cy="88" rx="30" ry="40" fill="#b8c2d3" transform="rotate(-12 96 88)"/>'
    + '<ellipse cx="96" cy="88" rx="17" ry="25" fill="#f4a6c0" stroke="none" transform="rotate(-12 96 88)"/>'
    + '<circle cx="70" cy="92" r="30" fill="#9aa5b8"/>'
    + '<path d="M64,112 q-8,10 -18,8" fill="#fff"/>'
    + eye(68, 84, 8) + cheek(80, 100) + smile(66, 104, 6))

A['giraffe'] = svg('#a7f3d0',
    limb('M150,148 L170,176', '#f6b73c', 9) + limb('M140,150 L138,180', '#f6b73c', 9)
    + limb('M108,150 L96,178', '#f6b73c', 9) + limb('M118,152 L124,170 L112,182', '#f6b73c', 9)
    + '<path d="M162,130 q18,0 22,18" fill="none"/><circle cx="185" cy="150" r="5" fill="#8b4513"/>'
    + '<ellipse cx="132" cy="134" rx="38" ry="24" fill="#f6b73c"/>'
    + limb('M112,124 L70,52', '#f6b73c', 22)
    + '<g fill="#b4651f" stroke="none"><circle cx="122" cy="128" r="6"/><circle cx="145" cy="140" r="7"/><circle cx="150" cy="122" r="5"/><circle cx="102" cy="104" r="5"/><circle cx="88" cy="80" r="5"/><circle cx="96" cy="94" r="3.5"/></g>'
    + limb('M62,30 L58,16', '#f6b73c', 5) + '<circle cx="58" cy="15" r="5" fill="#b4651f"/>'
    + limb('M76,30 L78,16', '#f6b73c', 5) + '<circle cx="78" cy="15" r="5" fill="#b4651f"/>'
    + '<ellipse cx="90" cy="36" rx="12" ry="6" fill="#f6b73c" transform="rotate(25 90 36)"/>'
    + '<ellipse cx="60" cy="44" rx="26" ry="18" fill="#f6b73c" transform="rotate(-15 60 44)"/>'
    + '<ellipse cx="42" cy="52" rx="13" ry="10" fill="#f9d58a" stroke="none" transform="rotate(-15 42 52)"/>'
    + eye(64, 38, 8) + cheek(52, 54, 5, 3.5) + smile(42, 56, 6))

A['lion'] = svg('#fde68a',
    '<path d="M100,22 L114,40 L136,30 L138,52 L162,56 L150,76 L170,92 L150,106 L162,128 L138,128 L134,152 L114,140 L100,160 L86,140 L66,152 L62,128 L38,128 L50,106 L30,92 L50,76 L38,56 L62,52 L64,30 L86,40 Z" fill="#c2561c"/>'
    + '<circle cx="74" cy="60" r="11" fill="#f4a73b"/><circle cx="126" cy="60" r="11" fill="#f4a73b"/>'
    + '<circle cx="100" cy="92" r="40" fill="#f4a73b"/>'
    + '<ellipse cx="100" cy="110" rx="22" ry="16" fill="#fde7b0" stroke="none"/>'
    + eye(86, 86, 8) + eye(114, 86, 8)
    + '<path d="M93,102 L107,102 L100,110 Z" fill="#7c2d12"/>'
    + '<path d="M100,110 L100,116" fill="none"/>' + smile(100, 116, 10, True)
    + cheek(76, 104) + cheek(124, 104)
    + limb('M150,150 L172,126', '#f4a73b', 16)
    + '<circle cx="174" cy="122" r="13" fill="#f4a73b"/><path d="M168,116 l2,6 M175,113 l1,6 M181,117 l-2,5" fill="none" stroke-width="3"/>'
)

A['rabbit'] = svg('#c7d2fe',
    motion('M24,120 L50,120', 'M18,138 L46,136', 'M28,156 L52,150')
    + '<ellipse cx="96" cy="44" rx="11" ry="34" fill="#f4f1ea" transform="rotate(-20 96 44)"/>'
    + '<ellipse cx="96" cy="46" rx="5" ry="24" fill="#f9a8c4" stroke="none" transform="rotate(-20 96 46)"/>'
    + '<ellipse cx="122" cy="40" rx="11" ry="34" fill="#f4f1ea" transform="rotate(15 122 40)"/>'
    + '<ellipse cx="122" cy="42" rx="5" ry="24" fill="#f9a8c4" stroke="none" transform="rotate(15 122 42)"/>'
    + '<ellipse cx="70" cy="150" rx="24" ry="10" fill="#f4f1ea" transform="rotate(-25 70 150)"/>'
    + '<ellipse cx="88" cy="128" rx="40" ry="28" fill="#f4f1ea" transform="rotate(-25 88 128)"/>'
    + '<circle cx="52" cy="140" r="11" fill="#fff"/>'
    + shade('M60,140 Q90,160 122,130 Q118,152 90,158 Q70,158 60,140 Z')
    + '<ellipse cx="148" cy="138" rx="14" ry="7" fill="#f4f1ea" transform="rotate(30 148 138)"/>'
    + '<circle cx="114" cy="86" r="27" fill="#f4f1ea"/>'
    + eye(108, 80, 7) + eye(126, 82, 7)
    + '<path d="M118,94 l6,0 l-3,4 Z" fill="#f472b6"/>' + smile(121, 100, 5)
    + cheek(102, 96, 5, 3.5) + cheek(134, 96, 5, 3.5))

A['monkey'] = svg('#bbf7d0',
    '<path d="M10,40 Q100,24 190,46" fill="none" stroke="#7c4a1e" stroke-width="16"/>'
    + '<path d="M10,40 Q100,24 190,46" fill="none" stroke="#a16207" stroke-width="8"/>'
    + '<path d="M150,38 q8,-14 22,-12 q-6,12 -22,12 Z" fill="#22c55e"/>'
    + limb('M128,36 C130,60 122,80 112,96', '#a0612b', 11)
    + '<circle cx="128" cy="38" r="8" fill="#f2c99a"/>'
    + limb('M90,150 C70,172 50,160 54,142 C58,130 70,136 66,146', '#a0612b', 8)
    + limb('M86,148 L74,176', '#a0612b', 11) + limb('M108,148 L118,176', '#a0612b', 11)
    + '<ellipse cx="96" cy="128" rx="26" ry="30" fill="#a0612b"/>'
    + '<ellipse cx="96" cy="134" rx="15" ry="19" fill="#f2c99a" stroke="none"/>'
    + limb('M76,112 L46,90', '#a0612b', 11) + '<circle cx="44" cy="86" r="8" fill="#f2c99a"/>'
    + '<circle cx="62" cy="80" r="13" fill="#f2c99a"/><circle cx="132" cy="80" r="13" fill="#f2c99a"/>'
    + '<circle cx="97" cy="80" r="32" fill="#a0612b"/>'
    + '<path d="M97,66 C84,56 70,66 74,80 C66,92 78,108 97,106 C116,108 128,92 120,80 C124,66 110,56 97,66 Z" fill="#f2c99a"/>'
    + eye(88, 76, 7) + eye(106, 76, 7) + smile(97, 94, 9, True))

A['pig'] = svg('#bae6fd',
    '<g fill="#8b5a2b" stroke="none" opacity=".85"><ellipse cx="100" cy="172" rx="70" ry="12"/><circle cx="34" cy="150" r="6"/><circle cx="168" cy="146" r="7"/><circle cx="150" cy="128" r="4"/></g>'
    + limb('M70,150 L64,170', '#f9a8c4', 13) + limb('M134,150 L142,168', '#f9a8c4', 13)
    + '<path d="M156,104 c14,-4 14,14 4,12 c-8,-2 -2,-14 8,-10" fill="none" stroke-width="5"/>'
    + '<ellipse cx="104" cy="118" rx="56" ry="40" fill="#f9a8c4"/>'
    + shade('M52,128 Q104,172 158,124 Q150,156 104,158 Q62,156 52,128 Z')
    + limb('M86,152 L84,174', '#f9a8c4', 13) + limb('M118,154 L122,174', '#f9a8c4', 13)
    + '<path d="M58,70 L52,44 L78,58 Z" fill="#f472b6"/><path d="M104,62 L118,40 L122,68 Z" fill="#f472b6"/>'
    + '<circle cx="84" cy="84" r="32" fill="#f9a8c4"/>'
    + '<ellipse cx="72" cy="96" rx="15" ry="11" fill="#f472b6"/>'
    + '<ellipse cx="67" cy="96" rx="2.5" ry="4" fill="' + O + '" stroke="none"/><ellipse cx="77" cy="96" rx="2.5" ry="4" fill="' + O + '" stroke="none"/>'
    + eye(76, 74, 7) + eye(96, 74, 7) + smile(92, 106, 7) + cheek(104, 94, 5, 3.5))

A['bear'] = svg('#fecaca',
    limb('M78,150 L72,176', '#8b5a2b', 18) + limb('M120,150 L128,176', '#8b5a2b', 18)
    + '<ellipse cx="100" cy="132" rx="40" ry="36" fill="#8b5a2b"/>'
    + '<ellipse cx="100" cy="140" rx="24" ry="22" fill="#d6a46c" stroke="none"/>'
    + limb('M66,124 L52,150', '#8b5a2b', 16)
    + limb('M132,118 L160,84', '#8b5a2b', 16) + '<ellipse cx="162" cy="78" rx="12" ry="14" fill="#8b5a2b"/>'
    + '<circle cx="162" cy="80" r="5" fill="#d6a46c" stroke="none"/>'
    + '<circle cx="72" cy="44" r="14" fill="#8b5a2b"/><circle cx="72" cy="44" r="6" fill="#d6a46c" stroke="none"/>'
    + '<circle cx="128" cy="44" r="14" fill="#8b5a2b"/><circle cx="128" cy="44" r="6" fill="#d6a46c" stroke="none"/>'
    + '<circle cx="100" cy="72" r="34" fill="#8b5a2b"/>'
    + '<ellipse cx="100" cy="86" rx="16" ry="12" fill="#d6a46c"/>'
    + '<ellipse cx="100" cy="80" rx="7" ry="5" fill="' + O + '" stroke="none"/>'
    + eye(86, 66, 7) + eye(114, 66, 7) + smile(100, 90, 6) + cheek(78, 82, 5, 3.5) + cheek(122, 82, 5, 3.5))

A['dolphin'] = svg('#a5f3fc',
    '<path d="M4,150 Q30,138 56,150 T108,150 T160,150 T200,148 L200,200 L0,200 Z" fill="#0ea5e9" stroke="none"/>'
    + '<g stroke="none" fill="#fff"><circle cx="46" cy="132" r="5"/><circle cx="34" cy="120" r="4"/><circle cx="58" cy="118" r="3.5"/></g>'
    + '<path d="M70,60 L82,36 L94,58 Z" fill="#3b82f6"/>'
    + '<path d="M44,148 C40,100 70,58 120,52 C140,50 156,56 166,66 C176,62 186,62 190,66 C180,70 172,74 166,78 C150,80 136,76 124,80 C96,88 72,110 64,148 Z" fill="#60a5fa"/>'
    + '<path d="M64,140 C70,112 90,92 120,84 C134,80 150,82 164,80 C150,90 128,94 112,100 C92,108 76,124 70,146 Z" fill="#dbeafe" stroke="none"/>'
    + '<path d="M44,148 L28,160 L46,166 L56,152" fill="#60a5fa"/><path d="M56,152 L64,172 L72,154" fill="#60a5fa"/>'
    + '<path d="M104,92 L92,112 L114,100 Z" fill="#3b82f6"/>'
    + eye(140, 64, 7) + '<path d="M168,76 q-6,6 -16,6" fill="none"/>' + cheek(150, 78, 5, 3)
    + '<path d="M0,170 Q30,160 60,170 T120,170 T200,168" fill="none" stroke="#fff" stroke-width="5" opacity=".8"/>')

A['bat'] = svg('#fef3c7',
    '<circle cx="152" cy="46" r="20" fill="#fde047" stroke="none" opacity=".9"/>'
    + '<path d="M96,94 C76,60 40,52 12,64 C24,74 26,88 22,100 C34,94 46,100 50,112 C58,104 70,106 76,118 C82,110 90,108 96,112 Z" fill="#6d5a8f"/>'
    + '<path d="M104,94 C124,60 160,52 188,64 C176,74 174,88 178,100 C166,94 154,100 150,112 C142,104 130,106 124,118 C118,110 110,108 104,112 Z" fill="#6d5a8f"/>'
    + '<path d="M96,94 C80,72 52,64 30,68 M104,94 C120,72 148,64 170,68" fill="none" stroke-width="3"/>'
    + '<path d="M80,78 L76,48 L94,66 Z" fill="#8b77b0"/><path d="M120,78 L124,48 L106,66 Z" fill="#8b77b0"/>'
    + '<path d="M80,72 L79,56 L88,66 Z" fill="#f9a8c4" stroke="none"/><path d="M120,72 L121,56 L112,66 Z" fill="#f9a8c4" stroke="none"/>'
    + '<ellipse cx="100" cy="112" rx="18" ry="26" fill="#8b77b0"/>'
    + '<circle cx="100" cy="86" r="22" fill="#8b77b0"/>'
    + eye(91, 82, 7) + eye(109, 82, 7) + smile(100, 96, 7)
    + '<path d="M95,98 l2,5 l2,-4 M105,98 l-2,5 l-2,-4" fill="#fff" stroke-width="2"/>'
    + cheek(84, 94, 4, 3) + cheek(116, 94, 4, 3)
    + limb('M94,136 L90,150', '#8b77b0', 5) + limb('M106,136 L110,150', '#8b77b0', 5))

A['kangaroo'] = svg('#fed7aa',
    motion('M150,96 L178,92', 'M156,114 L184,114')
    + limb('M128,148 C150,164 170,170 192,160', '#c8864b', 15)
    + '<ellipse cx="108" cy="176" rx="36" ry="8" fill="#c8864b" transform="rotate(-8 108 176)"/>'
    + '<ellipse cx="122" cy="146" rx="22" ry="28" fill="#c8864b"/>'
    + '<ellipse cx="96" cy="110" rx="28" ry="42" fill="#c8864b" transform="rotate(28 96 110)"/>'
    + '<circle cx="88" cy="114" r="10" fill="#c8864b"/>'
    + '<path d="M82,106 l-4,-9 l8,5 Z M92,104 l4,-9 l2,9 Z" fill="#c8864b" stroke-width="3"/>'
    + eye(85, 113, 3.5, (1, 0)) + eye(93, 113, 3.5, (1, 0))
    + '<path d="M66,120 Q90,146 116,122 Q114,142 92,148 Q72,144 66,120 Z" fill="#e8b98a"/>'
    + limb('M74,90 L52,100', '#c8864b', 8) + limb('M80,98 L60,114', '#c8864b', 8)
    + '<path d="M66,42 L62,14 L80,36 Z" fill="#c8864b"/><path d="M80,40 L90,12 L94,40 Z" fill="#c8864b"/>'
    + '<path d="M68,38 L65,22 L76,34 Z" fill="#f9a8c4" stroke="none"/>'
    + '<ellipse cx="72" cy="58" rx="22" ry="18" fill="#c8864b"/>'
    + '<ellipse cx="50" cy="66" rx="16" ry="10" fill="#e8b98a" transform="rotate(-10 50 66)"/>'
    + '<ellipse cx="38" cy="64" rx="4" ry="3" fill="' + O + '" stroke="none"/>'
    + eye(72, 52, 7) + smile(50, 72, 5) + cheek(84, 66, 5, 3.5))

# ---------------- Other animals ----------------

A['owl'] = svg('#c4b5fd',
    '<path d="M20,170 L180,170" fill="none" stroke="#7c4a1e" stroke-width="14"/>'
    + '<path d="M20,170 L180,170" fill="none" stroke="#a16207" stroke-width="6"/>'
    + '<path d="M60,104 C30,90 22,60 30,44 C46,58 58,74 66,90 Z" fill="#6d4c41"/>'
    + '<path d="M140,104 C166,110 180,128 176,150 C160,140 146,128 136,118 Z" fill="#6d4c41"/>'
    + '<ellipse cx="100" cy="112" rx="44" ry="56" fill="#8d6e63"/>'
    + '<ellipse cx="100" cy="128" rx="28" ry="34" fill="#f5deb3" stroke="none"/>'
    + '<path d="M86,118 q4,5 8,0 M106,118 q4,5 8,0 M92,134 q4,5 8,0 M100,148 q4,5 8,0 M86,148 q4,5 8,0" fill="none" stroke="#b08968" stroke-width="3"/>'
    + '<path d="M62,66 L58,40 L80,58 Z" fill="#8d6e63"/><path d="M138,66 L142,40 L120,58 Z" fill="#8d6e63"/>'
    + '<circle cx="80" cy="82" r="18" fill="#fb923c"/><circle cx="120" cy="82" r="18" fill="#fb923c"/>'
    + eye(80, 82, 12) + eye(120, 82, 12)
    + '<path d="M93,96 L107,96 L100,110 Z" fill="#facc15"/>'
    + '<path d="M84,166 l-6,8 M90,166 l0,9 M96,166 l6,8 M110,166 l-6,8 M116,166 l0,9 M122,166 l6,8" fill="none" stroke="#f59e0b" stroke-width="5"/>')

A['penguin'] = svg('#bfdbfe',
    '<path d="M10,164 Q100,150 190,166 L190,200 L10,200 Z" fill="#fff" stroke="none" opacity=".8"/>'
    + motion('M20,120 L46,124', 'M16,140 L44,140')
    + '<path d="M84,170 l-14,8 l22,0 Z M116,170 l14,8 l-22,0 Z" fill="#fb923c"/>'
    + limb('M66,100 L36,76', O, 14)
    + limb('M134,100 L166,84', O, 14)
    + '<ellipse cx="100" cy="112" rx="40" ry="60" fill="' + O + '" transform="rotate(-8 100 112)"/>'
    + '<ellipse cx="102" cy="124" rx="27" ry="44" fill="#fff" stroke="none" transform="rotate(-8 102 124)"/>'
    + '<path d="M70,62 C80,46 120,44 130,62 C124,80 112,84 100,86 C88,84 76,80 70,62 Z" fill="#fff" stroke="none"/>'
    + eye(88, 66, 8) + eye(112, 66, 8)
    + '<path d="M94,78 L108,78 L100,90 Z" fill="#fb923c"/>'
    + cheek(80, 82, 6, 3.5) + cheek(120, 82, 6, 3.5))

A['parrot'] = svg('#bbf7d0',
    '<path d="M100,130 L80,186 L94,182 L104,190 L112,138 Z" fill="#2563eb"/>'
    + '<path d="M104,132 L120,184 L128,176 L116,128 Z" fill="#facc15"/>'
    + '<path d="M90,96 C60,70 30,64 8,74 C24,84 30,92 32,104 C50,98 66,106 80,116 Z" fill="#2563eb"/>'
    + '<path d="M86,100 C66,86 46,82 28,86" fill="none" stroke="#facc15" stroke-width="7"/>'
    + '<path d="M118,96 C140,66 170,56 192,64 C178,76 174,86 174,98 C156,94 140,104 126,114 Z" fill="#2563eb"/>'
    + '<path d="M122,100 C140,84 160,76 178,76" fill="none" stroke="#facc15" stroke-width="7"/>'
    + '<ellipse cx="104" cy="112" rx="24" ry="32" fill="#ef4444"/>'
    + '<circle cx="104" cy="70" r="26" fill="#ef4444"/>'
    + '<ellipse cx="110" cy="66" rx="14" ry="13" fill="#fff" stroke="none"/>'
    + '<path d="M120,72 C138,70 140,92 126,96 C126,88 122,82 116,82 Z" fill="#facc15"/>'
    + eye(108, 64, 7) + cheek(100, 82, 5, 3.5)
    + '<path d="M96,140 l-4,10 M104,142 l0,10 M112,140 l4,10" fill="none" stroke-width="4"/>')

A['turtle'] = svg('#fef08a',
    '<g transform="translate(-12,0)">' +
    '<ellipse cx="100" cy="172" rx="76" ry="10" fill="#000" opacity=".12" stroke="none"/>'
    + limb('M66,150 L56,170', '#86efac', 14) + limb('M136,150 L150,168', '#86efac', 14)
    + limb('M150,128 L178,118', '#86efac', 14)
    + '<circle cx="182" cy="112" r="20" fill="#86efac"/>'
    + eye(184, 106, 7) + smile(186, 120, 6) + cheek(174, 120, 5, 3)
    + '<path d="M164,140 l12,6" fill="none"/>'
    + '<path d="M36,150 C36,90 72,64 104,64 C140,64 166,92 166,150 Z" fill="#16a34a"/>'
    + '<path d="M80,96 L104,84 L128,96 L128,122 L104,134 L80,122 Z" fill="#22c55e"/>'
    + '<path d="M80,96 L58,108 M128,96 L150,108 M80,122 L56,138 M128,122 L152,138 M104,134 L104,150 M104,84 L104,66" fill="none" stroke-width="4"/>'
    + shade('M40,140 Q100,160 162,140 L166,150 L36,150 Z')
    + '<path d="M30,150 L170,150" fill="none"/>'
    + limb('M84,152 L82,172', '#86efac', 14) + limb('M120,152 L124,172', '#86efac', 14)
    + '<path d="M36,140 l-14,8" fill="none"/></g>')

A['snake'] = svg('#fecaca',
    limb('M40,170 C10,150 40,120 80,130 C120,140 150,128 140,100 C130,72 90,82 100,56', '#84cc16', 24)
    + '<path d="M40,170 C10,150 40,120 80,130 C120,140 150,128 140,100 C130,72 90,82 100,56" fill="none" stroke="#4d7c0f" stroke-width="24" stroke-dasharray="6 18" stroke-linecap="butt"/>'
    + '<path d="M40,170 C10,150 40,120 80,130 C120,140 150,128 140,100 C130,72 90,82 100,56" fill="none" stroke="#d9f99d" stroke-width="6" opacity=".7" stroke-dasharray="0" />'
    + '<path d="M120,40 l20,-4 l-6,-6 M140,36 l4,6" fill="none" stroke="#e11d48" stroke-width="4"/>'
    + '<ellipse cx="106" cy="44" rx="24" ry="18" fill="#84cc16" transform="rotate(-15 106 44)"/>'
    + eye(100, 38, 8) + eye(116, 34, 7) + smile(112, 50, 7) + cheek(96, 52, 5, 3))

A['lizard'] = svg('#fde68a',
    limb('M118,140 C140,170 176,168 180,146 C182,132 166,128 162,140', '#2dd4bf', 10)
    + limb('M76,90 L48,70', '#2dd4bf', 9) + limb('M120,104 L150,86', '#2dd4bf', 9)
    + limb('M80,128 L54,150', '#2dd4bf', 9) + limb('M120,132 L142,156', '#2dd4bf', 9)
    + '<g fill="#2dd4bf"><circle cx="44" cy="66" r="6"/><circle cx="154" cy="82" r="6"/><circle cx="50" cy="154" r="6"/><circle cx="146" cy="160" r="6"/></g>'
    + '<ellipse cx="100" cy="112" rx="24" ry="38" fill="#2dd4bf" transform="rotate(-25 100 112)"/>'
    + '<g fill="#0f766e" stroke="none"><circle cx="96" cy="110" r="4"/><circle cx="108" cy="122" r="4"/><circle cx="92" cy="128" r="3"/><circle cx="110" cy="100" r="3"/></g>'
    + '<ellipse cx="74" cy="66" rx="22" ry="18" fill="#2dd4bf" transform="rotate(-25 74 66)"/>'
    + eye(66, 58, 8) + eye(84, 52, 7) + smile(70, 74, 7) + cheek(60, 72, 4, 3))

A['frog'] = svg('#a5b4fc',
    '<ellipse cx="100" cy="176" rx="64" ry="14" fill="#22c55e" opacity=".9"/>'
    + '<path d="M100,176 L130,164" fill="none" stroke="#15803d" stroke-width="4"/>'
    + motion('M70,184 L60,196', 'M130,184 L140,196')
    + limb('M74,128 C50,140 40,160 30,170', '#4ade80', 12)
    + limb('M126,128 C150,140 160,160 170,170', '#4ade80', 12)
    + '<path d="M20,172 l10,-4 l10,6 M160,174 l10,-6 l10,4" fill="none" stroke-width="4"/>'
    + '<ellipse cx="100" cy="112" rx="40" ry="34" fill="#4ade80"/>'
    + '<ellipse cx="100" cy="124" rx="24" ry="18" fill="#bbf7d0" stroke="none"/>'
    + limb('M70,100 L42,80', '#4ade80', 10) + limb('M130,100 L158,80', '#4ade80', 10)
    + '<circle cx="40" cy="76" r="7" fill="#4ade80"/><circle cx="160" cy="76" r="7" fill="#4ade80"/>'
    + '<circle cx="82" cy="72" r="18" fill="#4ade80"/><circle cx="118" cy="72" r="18" fill="#4ade80"/>'
    + eye(82, 70, 11) + eye(118, 70, 11)
    + '<path d="M76,98 Q100,118 124,98" fill="#e11d48"/>'
    + cheek(70, 98, 6, 4) + cheek(130, 98, 6, 4))

A['salamander'] = svg('#d9f99d',
    limb('M120,120 C150,110 160,140 186,128', '#f97316', 14)
    + limb('M66,104 L52,80', '#f97316', 9) + limb('M70,128 L52,150', '#f97316', 9)
    + limb('M114,108 L126,84', '#f97316', 9) + limb('M114,130 L130,152', '#f97316', 9)
    + '<g fill="#f97316"><circle cx="50" cy="76" r="6"/><circle cx="50" cy="154" r="6"/><circle cx="128" cy="80" r="6"/><circle cx="132" cy="156" r="6"/></g>'
    + '<ellipse cx="92" cy="118" rx="38" ry="18" fill="#f97316" transform="rotate(-5 92 118)"/>'
    + '<g fill="' + O + '" stroke="none"><circle cx="80" cy="112" r="4"/><circle cx="98" cy="120" r="5"/><circle cx="112" cy="112" r="3.5"/><circle cx="150" cy="120" r="3.5"/><circle cx="170" cy="130" r="3"/></g>'
    + '<ellipse cx="46" cy="110" rx="22" ry="17" fill="#f97316"/>'
    + eye(40, 102, 8) + eye(56, 100, 7) + smile(40, 118, 7) + cheek(56, 116, 4, 3))

A['butterfly'] = svg('#fef9c3',
    '<path d="M96,90 C70,40 20,40 24,76 C26,100 60,104 92,96 Z" fill="#a855f7"/>'
    + '<path d="M104,90 C130,40 180,40 176,76 C174,100 140,104 108,96 Z" fill="#a855f7"/>'
    + '<path d="M94,104 C60,104 34,124 44,148 C54,166 82,148 96,116 Z" fill="#f472b6"/>'
    + '<path d="M106,104 C140,104 166,124 156,148 C146,166 118,148 104,116 Z" fill="#f472b6"/>'
    + '<g stroke="none"><circle cx="52" cy="70" r="10" fill="#fde047"/><circle cx="148" cy="70" r="10" fill="#fde047"/><circle cx="66" cy="132" r="8" fill="#fff"/><circle cx="134" cy="132" r="8" fill="#fff"/><circle cx="76" cy="62" r="5" fill="#fff"/><circle cx="124" cy="62" r="5" fill="#fff"/></g>'
    + '<ellipse cx="100" cy="116" rx="9" ry="34" fill="#4c1d95"/>'
    + '<path d="M94,74 C88,52 74,44 70,52 M106,74 C112,52 126,44 130,52" fill="none" stroke-width="4"/>'
    + '<circle cx="70" cy="52" r="5" fill="#4c1d95"/><circle cx="130" cy="52" r="5" fill="#4c1d95"/>'
    + '<circle cx="100" cy="80" r="16" fill="#7c3aed"/>'
    + eye(94, 78, 6) + eye(107, 78, 6) + smile(100, 88, 5))

A['bee'] = svg('#e0f2fe',
    '<path d="M20,150 C40,120 50,170 70,140 C80,124 76,118 84,112" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="8 8"/>'
    + '<ellipse cx="92" cy="62" rx="22" ry="34" fill="#fff" opacity=".85" transform="rotate(-30 92 62)"/>'
    + '<ellipse cx="124" cy="60" rx="20" ry="32" fill="#fff" opacity=".85" transform="rotate(25 124 60)"/>'
    + '<path d="M164,118 L182,124 L164,130 Z" fill="' + O + '"/>'
    + '<ellipse cx="118" cy="114" rx="50" ry="36" fill="#facc15"/>'
    + '<path d="M104,80 Q96,114 104,148 M128,80 Q136,114 128,148 M150,90 Q158,114 150,138" fill="none" stroke="' + O + '" stroke-width="12" stroke-linecap="butt"/>'
    + '<circle cx="70" cy="108" r="28" fill="#facc15"/>'
    + '<path d="M62,84 C56,64 44,58 40,64 M78,82 C80,62 90,54 96,58" fill="none" stroke-width="4"/>'
    + '<circle cx="40" cy="64" r="5" fill="' + O + '"/><circle cx="96" cy="58" r="5" fill="' + O + '"/>'
    + eye(60, 104, 8) + eye(80, 104, 7) + smile(68, 120, 7) + cheek(52, 118, 5, 3.5) + cheek(88, 116, 5, 3.5)
    + limb('M100,146 L94,164', O, 3) + limb('M124,148 L126,166', O, 3))

os.makedirs(OUT, exist_ok=True)
for name, s in A.items():
    with open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf-8') as f:
        f.write(s)
print(len(A), 'pictures written')
