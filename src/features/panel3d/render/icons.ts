/**
 * Bibliothèque d'icônes d'étiquettes, rendu « léger 3D » : dégradés, reflets
 * et ombre portée. Chaque icône est dessinée dans un carré 64 × 64 et produite
 * en SVG texte : utilisable à l'écran, dans le tableau (SVG imbriqué), à
 * l'impression et dans le PDF (rastérisé).
 */

type Tone = readonly [light: string, dark: string];

const PALETTE = {
  white: ['#ffffff', '#cfd6df'],
  steel: ['#f1f5f9', '#8b98a9'],
  gray: ['#d7dde5', '#7b8794'],
  dark: ['#5b6675', '#141a22'],
  glass: ['#e0f2fe', '#60a5fa'],
  blue: ['#93c5fd', '#1d4ed8'],
  sky: ['#bae6fd', '#0284c7'],
  water: ['#7dd3fc', '#0369a1'],
  orange: ['#fdba74', '#ea580c'],
  red: ['#fca5a5', '#b91c1c'],
  yellow: ['#fef08a', '#eab308'],
  amber: ['#fde68a', '#d97706'],
  green: ['#86efac', '#15803d'],
  leaf: ['#bef264', '#4d7c0f'],
  wood: ['#e7c9a0', '#8a5a2b'],
  purple: ['#d8b4fe', '#7e22ce'],
  flame: ['#fde047', '#dc2626'],
} as const satisfies Record<string, Tone>;

type ToneKey = keyof typeof PALETTE;

interface Ctx {
  /** Remplissage en dégradé (volume). */
  g: (tone: ToneKey) => string;
}

type Draw = (c: Ctx) => string;

const S = (color: string, w = 2) => `stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const OUT = S('#1f2937', 1.6);
const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra = OUT) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = OUT) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const path = (d: string, fill: string, extra = OUT) => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, color = '#1f2937', w = 2) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${S(color, w)}/>`;
/** Reflet brillant (volume). */
const shine = (x: number, y: number, w: number, h: number, rx = 3) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#ffffff" opacity="0.45"/>`;

/* --------- Éléments réutilisés --------- */
const socketFace = (c: Ctx, cx = 32, cy = 32, r = 17) =>
  [
    rect(cx - r - 5, cy - r - 5, (r + 5) * 2, (r + 5) * 2, 8, c.g('white')),
    circle(cx, cy, r, c.g('steel')),
    circle(cx, cy, r - 4, c.g('white'), S('#64748b', 1.2)),
    circle(cx - r * 0.38, cy, 2.6, '#1f2937', ''),
    circle(cx + r * 0.38, cy, 2.6, '#1f2937', ''),
    rect(cx - 1.6, cy - r + 3, 3.2, 5, 1, c.g('steel'), S('#475569', 0.8)),
  ].join('');

const badge = (c: Ctx, tone: ToneKey, inner: string) => circle(49, 49, 13, c.g(tone), S('#ffffff', 2.5)) + inner;
const bolt = (x: number, y: number, s: number, fill: string) =>
  path(`M${x + 2 * s} ${y}L${x - 3 * s} ${y + 7 * s}H${x}L${x - 1.5 * s} ${y + 13 * s}L${x + 4 * s} ${y + 5 * s}H${x + 1 * s}Z`, fill, S('#1f2937', 1.2));
const drop = (cx: number, cy: number, s: number, fill: string) =>
  path(`M${cx} ${cy - 7 * s}C${cx + 5 * s} ${cy - 1 * s} ${cx + 6 * s} ${cy + 2 * s} ${cx + 6 * s} ${cy + 3.5 * s}A${6 * s} ${6 * s} 0 0 1 ${cx - 6 * s} ${cy + 3.5 * s}C${cx - 6 * s} ${cy + 2 * s} ${cx - 5 * s} ${cy - 1 * s} ${cx} ${cy - 7 * s}Z`, fill, S('#1f2937', 1.2));
const snowflake = (cx: number, cy: number, r: number, color: string) =>
  [0, 60, 120].map((a) => {
    const rad = (a * Math.PI) / 180;
    const dx = Math.cos(rad) * r;
    const dy = Math.sin(rad) * r;
    return line(cx - dx, cy - dy, cx + dx, cy + dy, color, 2.2);
  }).join('');
const house = (c: Ctx, tone: ToneKey = 'white') => path('M8 30L32 10L56 30V56H8Z', c.g(tone));
const fanBlades = (cx: number, cy: number, r: number, fill: string) =>
  [0, 120, 240]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * r;
      const y1 = cy + Math.sin(rad) * r;
      const rad2 = rad + 0.9;
      const x2 = cx + Math.cos(rad2) * r * 0.85;
      const y2 = cy + Math.sin(rad2) * r * 0.85;
      return path(`M${cx} ${cy}Q${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}Z`, fill, S('#1f2937', 1));
    })
    .join('') + circle(cx, cy, r * 0.22, '#e5e7eb', S('#1f2937', 1));
const waves = (x: number, y: number, w: number, color = '#0369a1') =>
  `<path d="M${x} ${y}q${w / 8} -4 ${w / 4} 0t${w / 4} 0t${w / 4} 0t${w / 4} 0" fill="none" ${S(color, 2.2)}/>`;
const bulb = (c: Ctx, cx: number, cy: number, s: number) =>
  path(
    `M${cx} ${cy - 16 * s}C${cx + 11 * s} ${cy - 16 * s} ${cx + 14 * s} ${cy - 6 * s} ${cx + 9 * s} ${cy + 2 * s}C${cx + 7 * s} ${cy + 5 * s} ${cx + 6 * s} ${cy + 7 * s} ${cx + 6 * s} ${cy + 9 * s}H${cx - 6 * s}C${cx - 6 * s} ${cy + 7 * s} ${cx - 7 * s} ${cy + 5 * s} ${cx - 9 * s} ${cy + 2 * s}C${cx - 14 * s} ${cy - 6 * s} ${cx - 11 * s} ${cy - 16 * s} ${cx} ${cy - 16 * s}Z`,
    c.g('yellow'),
  ) +
  rect(cx - 6 * s, cy + 9 * s, 12 * s, 8 * s, 2, c.g('steel')) +
  line(cx - 6 * s, cy + 12 * s, cx + 6 * s, cy + 12 * s, '#475569', 1.2) +
  `<ellipse cx="${cx - 4 * s}" cy="${cy - 8 * s}" rx="${3 * s}" ry="${5 * s}" fill="#fff" opacity="0.6"/>`;
const rays = (cx: number, cy: number, r1: number, r2: number, color = '#f59e0b', angles = [-150, -120, -90, -60, -30]) =>
  angles
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return line(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1, cx + Math.cos(rad) * r2, cy + Math.sin(rad) * r2, color, 2.4);
    })
    .join('');
const car = (c: Ctx, x: number, y: number, s: number, tone: ToneKey = 'blue') =>
  path(
    `M${x} ${y + 12 * s}L${x + 4 * s} ${y + 4 * s}Q${x + 6 * s} ${y} ${x + 11 * s} ${y}H${x + 23 * s}Q${x + 28 * s} ${y} ${x + 30 * s} ${y + 4 * s}L${x + 34 * s} ${y + 12 * s}V${y + 19 * s}H${x}Z`,
    c.g(tone),
  ) +
  path(`M${x + 7 * s} ${y + 10 * s}L${x + 9 * s} ${y + 4 * s}H${x + 25 * s}L${x + 27 * s} ${y + 10 * s}Z`, c.g('glass'), S('#1f2937', 1.2)) +
  circle(x + 8 * s, y + 19 * s, 4 * s, c.g('dark')) +
  circle(x + 26 * s, y + 19 * s, 4 * s, c.g('dark'));

export interface IconDef {
  id: string;
  name: string;
  /** Mots déclenchant la suggestion automatique (sans accents, minuscules). */
  keywords: string[];
  draw: Draw;
}

export const LABEL_ICONS: IconDef[] = [
  {
    id: 'eclairage',
    name: 'Éclairage',
    keywords: ['eclairage', 'lumiere', 'lumieres', 'lampe', 'plafonnier', 'luminaire', 'lum'],
    draw: (c) => rays(32, 30, 20, 27) + bulb(c, 32, 32, 1.15),
  },
  { id: 'spot', name: 'Spots', keywords: ['spot', 'spots', 'encastre', 'downlight'], draw: (c) => circle(32, 22, 16, c.g('steel')) + circle(32, 22, 10, c.g('yellow')) + shine(24, 12, 10, 4) + rays(32, 44, 4, 16, '#f59e0b', [60, 90, 120]) },
  {
    id: 'bande-led',
    name: 'Bande LED',
    keywords: ['led', 'bande', 'ruban', 'bandeau'],
    draw: (c) =>
      path('M6 44L44 10L58 22L20 56Z', c.g('white')) +
      [0, 1, 2, 3, 4].map((i) => rect(14 + i * 7.6 - 3, 42 - i * 7 - 3, 6, 6, 1.5, c.g('yellow'), S('#92400e', 0.8))).join('') +
      line(10, 50, 50, 14, '#94a3b8', 1),
  },
  {
    id: 'eclairage-exterieur',
    name: 'Éclairage extérieur',
    keywords: ['exterieur', 'jardin eclairage', 'lanterne', 'applique ext', 'terrasse', 'facade'],
    draw: (c) =>
      rect(28, 36, 8, 22, 2, c.g('dark')) +
      path('M20 18L32 8L44 18Z', c.g('dark')) +
      rect(22, 18, 20, 18, 2, c.g('yellow')) +
      line(32, 18, 32, 36, '#92400e', 1.2) +
      rect(18, 56, 28, 4, 2, c.g('gray')),
  },
  {
    id: 'prise',
    name: 'Prises',
    keywords: ['prise', 'prises', 'pc', 'courant'],
    draw: (c) => socketFace(c),
  },
  {
    id: 'prises-cuisine',
    name: 'Prises cuisine',
    keywords: ['prises cuisine', 'prise cuisine', 'plan de travail', 'cuisine'],
    draw: (c) => socketFace(c, 26, 26, 14) + badge(c, 'orange', rect(41, 46, 16, 8, 2, c.g('dark'), S('#fff', 1)) + line(57, 48, 62, 46, '#fff', 2)),
  },
  {
    id: 'prises-salon',
    name: 'Prises salon',
    keywords: ['prises salon', 'prise salon', 'salon', 'sejour', 'sejour prises'],
    draw: (c) => socketFace(c, 26, 26, 14) + badge(c, 'blue', rect(40, 46, 18, 8, 2, c.g('white'), S('#1e3a8a', 1)) + rect(40, 42, 4, 12, 1.5, c.g('white'), S('#1e3a8a', 1)) + rect(54, 42, 4, 12, 1.5, c.g('white'), S('#1e3a8a', 1))),
  },
  {
    id: 'prises-chambres',
    name: 'Prises chambres',
    keywords: ['prises chambre', 'prise chambre', 'prises chambres', 'chambre', 'chambres'],
    draw: (c) => socketFace(c, 26, 26, 14) + badge(c, 'purple', rect(40, 48, 18, 6, 1.5, c.g('white'), S('#581c87', 1)) + rect(40, 44, 6, 5, 1.5, c.g('white'), S('#581c87', 1)) + line(40, 56, 40, 42, '#fff', 1.6)),
  },
  {
    id: 'prises-sdb',
    name: 'Prises salle de bain',
    keywords: ['salle de bain', 'sdb', 'salle d eau', 'sde'],
    draw: (c) => socketFace(c, 26, 26, 14) + badge(c, 'sky', drop(49, 48, 1, c.g('white'))),
  },
  {
    id: 'prise-exterieure',
    name: 'Prise extérieure',
    keywords: ['prise exterieure', 'prise ext', 'exterieure', 'ip44', 'ip55'],
    draw: (c) => socketFace(c, 28, 34, 14) + path('M10 16L46 16L42 8H14Z', c.g('sky')) + badge(c, 'leaf', path('M49 40C58 42 58 54 49 58C40 54 40 42 49 40Z', c.g('green'), S('#fff', 1))),
  },
  {
    id: 'prise-renforcee',
    name: 'Prise renforcée',
    keywords: ['renforcee', 'green up', 'greenup', 'prise ve', 'prise renforce'],
    draw: (c) => socketFace(c, 26, 26, 14) + badge(c, 'green', bolt(49, 41, 1.2, c.g('yellow'))),
  },
  {
    id: 'four',
    name: 'Four',
    keywords: ['four', 'fours', 'cuisson four'],
    draw: (c) =>
      rect(8, 8, 48, 48, 5, c.g('steel')) +
      rect(8, 8, 48, 11, 5, c.g('dark')) +
      [16, 26, 36, 46].map((x) => circle(x, 13.5, 2.6, c.g('steel'), S('#0f172a', 0.8))).join('') +
      rect(14, 25, 36, 24, 3, c.g('dark')) +
      rect(18, 29, 28, 16, 2, c.g('amber'), S('#7c2d12', 1)) +
      rect(16, 21.5, 32, 2.6, 1.3, c.g('white'), S('#334155', 0.8)) +
      shine(12, 10, 22, 3),
  },
  {
    id: 'plaque',
    name: 'Plaque de cuisson',
    keywords: ['plaque', 'plaques', 'induction', 'vitroceramique', 'cuisson', 'table de cuisson', 'cuisiniere'],
    draw: (c) =>
      rect(6, 10, 52, 44, 6, c.g('dark')) +
      [
        [22, 25, 9],
        [44, 25, 7],
        [22, 43, 7],
        [44, 43, 9],
      ]
        .map(([x, y, r]) => circle(x, y, r, 'none', S('#f97316', 2.2)) + circle(x, y, r - 4, 'none', S('#fb923c', 1.2)))
        .join('') +
      shine(10, 13, 30, 3),
  },
  {
    id: 'lave-vaisselle',
    name: 'Lave-vaisselle',
    keywords: ['lave vaisselle', 'lave-vaisselle', 'lv', 'vaisselle'],
    draw: (c) =>
      rect(10, 6, 44, 52, 5, c.g('white')) +
      rect(10, 6, 44, 10, 5, c.g('steel')) +
      circle(46, 11, 2.2, c.g('blue'), '') +
      rect(18, 21, 28, 3, 1.5, c.g('steel'), S('#334155', 0.8)) +
      circle(32, 40, 10, c.g('white'), S('#64748b', 1.4)) +
      circle(32, 40, 5.5, 'none', S('#94a3b8', 1.2)) +
      shine(14, 18, 6, 34),
  },
  {
    id: 'lave-linge',
    name: 'Lave-linge',
    keywords: ['lave linge', 'lave-linge', 'll', 'machine a laver', 'linge', 'buanderie'],
    draw: (c) =>
      rect(10, 6, 44, 52, 5, c.g('white')) +
      rect(10, 6, 44, 10, 5, c.g('steel')) +
      circle(46, 11, 2.6, c.g('steel'), S('#334155', 0.8)) +
      rect(15, 9.5, 12, 3, 1.5, c.g('dark'), '') +
      circle(32, 36, 15, c.g('steel')) +
      circle(32, 36, 11, c.g('water')) +
      waves(22, 38, 20, '#e0f2fe') +
      `<ellipse cx="27" cy="31" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>`,
  },
  {
    id: 'seche-linge',
    name: 'Sèche-linge',
    keywords: ['seche linge', 'seche-linge', 'sl', 'sechoir'],
    draw: (c) =>
      rect(10, 6, 44, 52, 5, c.g('white')) +
      rect(10, 6, 44, 10, 5, c.g('steel')) +
      circle(46, 11, 2.6, c.g('steel'), S('#334155', 0.8)) +
      circle(32, 36, 15, c.g('steel')) +
      circle(32, 36, 11, c.g('orange')) +
      [26, 32, 38].map((x) => `<path d="M${x} 44q-3 -4 0 -8t0 -8" fill="none" ${S('#fff7ed', 2)}/>`).join(''),
  },
  {
    id: 'seche-serviettes',
    name: 'Sèche-serviettes',
    keywords: ['seche serviette', 'seche-serviettes', 'seche serviettes', 'serviettes'],
    draw: (c) =>
      rect(14, 6, 5, 52, 2.5, c.g('white')) +
      rect(45, 6, 5, 52, 2.5, c.g('white')) +
      [12, 20, 28, 36, 44, 52].map((y) => rect(16, y, 32, 3.5, 1.7, c.g('white'), S('#64748b', 1))).join('') +
      path('M22 18H40V40Q31 44 22 40Z', c.g('sky'), S('#0c4a6e', 1.2)),
  },
  {
    id: 'refrigerateur',
    name: 'Réfrigérateur',
    keywords: ['refrigerateur', 'frigo', 'frigidaire', 'refrigerateur congelateur', 'cellier'],
    draw: (c) =>
      rect(14, 4, 36, 56, 5, c.g('white')) +
      line(14, 24, 50, 24, '#475569', 1.6) +
      rect(18, 10, 3, 9, 1.5, c.g('steel'), S('#334155', 0.8)) +
      rect(18, 29, 3, 14, 1.5, c.g('steel'), S('#334155', 0.8)) +
      snowflake(38, 42, 7, '#0284c7') +
      shine(40, 7, 6, 14),
  },
  {
    id: 'congelateur',
    name: 'Congélateur',
    keywords: ['congelateur', 'congel', 'surgele'],
    draw: (c) =>
      rect(6, 22, 52, 34, 5, c.g('white')) +
      rect(4, 16, 56, 9, 4, c.g('steel')) +
      rect(26, 26, 12, 3, 1.5, c.g('steel'), S('#334155', 0.8)) +
      snowflake(32, 43, 8, '#0284c7'),
  },
  {
    id: 'micro-ondes',
    name: 'Micro-ondes',
    keywords: ['micro onde', 'micro-ondes', 'micro ondes', 'mo'],
    draw: (c) =>
      rect(6, 14, 52, 36, 5, c.g('steel')) +
      rect(11, 19, 32, 26, 3, c.g('dark')) +
      rect(14, 22, 26, 20, 2, c.g('amber'), S('#7c2d12', 0.8)) +
      [22, 29, 36].map((y) => rect(47, y, 7, 4, 1, c.g('dark'), '')).join('') +
      circle(50.5, 43, 2.5, c.g('white'), S('#334155', 0.8)),
  },
  {
    id: 'hotte',
    name: 'Hotte',
    keywords: ['hotte', 'aspirante'],
    draw: (c) => rect(24, 4, 16, 22, 2, c.g('steel')) + path('M8 44L20 26H44L56 44Z', c.g('steel')) + rect(6, 44, 52, 8, 3, c.g('gray')) + [18, 32, 46].map((x) => line(x, 55, x, 60, '#94a3b8', 1.6)).join(''),
  },
  {
    id: 'chauffe-eau',
    name: 'Chauffe-eau',
    keywords: ['chauffe eau', 'chauffe-eau', 'cumulus', 'ballon', 'ecs', 'eau chaude'],
    draw: (c) =>
      rect(16, 4, 32, 50, 16, c.g('white')) +
      circle(32, 22, 6, c.g('steel'), S('#334155', 1)) +
      line(32, 22, 35, 19, '#dc2626', 1.4) +
      rect(22, 54, 4, 7, 1, c.g('red'), S('#7f1d1d', 0.8)) +
      rect(38, 54, 4, 7, 1, c.g('blue'), S('#1e3a8a', 0.8)) +
      drop(32, 40, 0.9, c.g('red')) +
      shine(20, 10, 5, 36, 2.5),
  },
  {
    id: 'ballon-thermo',
    name: 'Ballon thermodynamique',
    keywords: ['thermodynamique', 'ballon thermo', 'cet', 'chauffe eau thermodynamique'],
    draw: (c) =>
      rect(16, 20, 32, 40, 12, c.g('white')) +
      rect(14, 4, 36, 18, 6, c.g('steel')) +
      circle(32, 13, 6.5, c.g('dark')) +
      fanBlades(32, 13, 5.5, '#cbd5e1') +
      drop(32, 42, 0.9, c.g('red')),
  },
  {
    id: 'pac',
    name: 'Pompe à chaleur',
    keywords: ['pac', 'pompe a chaleur', 'pompe chaleur', 'aerothermie', 'geothermie'],
    draw: (c) => rect(4, 12, 56, 40, 5, c.g('steel')) + circle(24, 32, 15, c.g('dark')) + fanBlades(24, 32, 13, '#cbd5e1') + [20, 28, 36, 44].map((y) => rect(44, y, 11, 3, 1.5, c.g('gray'), '')).join('') + rect(8, 52, 8, 5, 1, c.g('gray')) + rect(48, 52, 8, 5, 1, c.g('gray')),
  },
  {
    id: 'climatisation',
    name: 'Climatisation',
    keywords: ['clim', 'climatisation', 'climatiseur', 'split'],
    draw: (c) =>
      rect(4, 10, 56, 22, 8, c.g('white')) +
      line(10, 26, 54, 26, '#64748b', 1.4) +
      circle(52, 17, 1.8, c.g('green'), '') +
      [18, 32, 46].map((x) => `<path d="M${x} 38q-4 5 0 10t0 10" fill="none" ${S('#0ea5e9', 2.4)}/>`).join(''),
  },
  {
    id: 'radiateur',
    name: 'Radiateur',
    keywords: ['radiateur', 'radiateurs', 'convecteur', 'convecteurs', 'panneau rayonnant', 'rad'],
    draw: (c) => [10, 19, 28, 37, 46].map((x) => rect(x, 10, 8, 42, 3.5, c.g('white'))).join('') + rect(8, 52, 6, 6, 1, c.g('gray')) + rect(50, 52, 6, 6, 1, c.g('gray')),
  },
  {
    id: 'chauffage',
    name: 'Chauffage',
    keywords: ['chauffage', 'chaudiere', 'plancher chauffant', 'fil pilote', 'thermostat'],
    draw: (c) =>
      path('M32 4C40 16 50 22 50 38A18 18 0 0 1 14 38C14 30 18 26 22 20C24 28 28 30 30 30C28 20 30 12 32 4Z', c.g('flame')) +
      path('M32 30C36 36 40 40 40 46A8 8 0 0 1 24 46C24 42 27 38 32 30Z', c.g('yellow'), S('#b45309', 1)),
  },
  {
    id: 'vmc',
    name: 'VMC',
    keywords: ['vmc', 'ventilation', 'extracteur', 'aeration', 'ventilateur'],
    draw: (c) => circle(32, 32, 26, c.g('white')) + circle(32, 32, 20, c.g('steel'), S('#475569', 1.2)) + fanBlades(32, 32, 17, c.g('white')),
  },
  {
    id: 'volets',
    name: 'Volets roulants',
    keywords: ['volet', 'volets', 'volet roulant', 'store', 'stores', 'bso'],
    draw: (c) =>
      rect(8, 6, 40, 52, 3, c.g('glass')) +
      rect(6, 4, 44, 8, 3, c.g('steel')) +
      [14, 20, 26, 32].map((y) => rect(8, y, 40, 5, 1, c.g('white'), S('#64748b', 0.8))).join('') +
      path('M56 18L52 24H60Z', c.g('dark'), '') +
      path('M56 46L52 40H60Z', c.g('dark'), ''),
  },
  {
    id: 'garage',
    name: 'Garage',
    keywords: ['garage', 'atelier', 'cave', 'sous sol', 'dependance'],
    draw: (c) => house(c, 'white') + rect(16, 32, 32, 24, 1, c.g('steel')) + [38, 44, 50].map((y) => line(16, y, 48, y, '#64748b', 1.4)).join(''),
  },
  {
    id: 'porte-garage',
    name: 'Porte de garage',
    keywords: ['porte de garage', 'porte garage', 'motorisation garage', 'sectionnelle'],
    draw: (c) => rect(6, 8, 52, 50, 3, c.g('steel')) + [18, 28, 38, 48].map((y) => rect(6, y, 52, 9, 1, c.g('white'), S('#64748b', 0.9))).join('') + rect(28, 50, 8, 3, 1.5, c.g('dark'), ''),
  },
  {
    id: 'portail',
    name: 'Portail',
    keywords: ['portail', 'portillon', 'motorisation portail', 'cloture'],
    draw: (c) =>
      rect(4, 14, 6, 44, 1.5, c.g('gray')) +
      rect(54, 14, 6, 44, 1.5, c.g('gray')) +
      path('M10 24Q21 16 32 22Q43 16 54 24V52H10Z', c.g('dark')) +
      [16, 22, 28, 36, 42, 48].map((x) => line(x, 26, x, 50, '#94a3b8', 1.2)).join('') +
      line(32, 22, 32, 52, '#0f172a', 1.4),
  },
  {
    id: 'alarme',
    name: 'Alarme',
    keywords: ['alarme', 'sirene', 'intrusion', 'securite', 'centrale alarme'],
    draw: (c) =>
      path('M18 44V30A14 14 0 0 1 46 30V44Z', c.g('red')) +
      rect(12, 44, 40, 8, 3, c.g('dark')) +
      rays(32, 30, 20, 27, '#ef4444') +
      shine(24, 24, 5, 14, 2.5),
  },
  {
    id: 'detecteur',
    name: 'Détecteur',
    keywords: ['detecteur', 'detection', 'daaf', 'fumee', 'mouvement', 'presence'],
    draw: (c) =>
      `<ellipse cx="32" cy="36" rx="24" ry="14" fill="${c.g('white')}" ${OUT}/>` +
      `<ellipse cx="32" cy="32" rx="18" ry="9" fill="${c.g('steel')}" ${S('#475569', 1)}/>` +
      circle(42, 34, 2.2, c.g('red'), '') +
      `<path d="M14 14q18 -10 36 0M20 20q12 -7 24 0" fill="none" ${S('#0284c7', 2.2)}/>`,
  },
  {
    id: 'interphone',
    name: 'Interphone',
    keywords: ['interphone', 'visiophone', 'portier', 'videophone'],
    draw: (c) =>
      rect(16, 4, 32, 56, 6, c.g('steel')) +
      rect(21, 10, 22, 16, 2, c.g('dark')) +
      rect(23, 12, 18, 12, 1, c.g('glass'), '') +
      [34, 38, 42].map((y) => line(24, y, 40, y, '#475569', 1.4)).join('') +
      circle(32, 51, 4, c.g('blue')),
  },
  {
    id: 'ecran-domotique',
    name: 'Écran domotique',
    keywords: ['domotique', 'ecran', 'tablette', 'knx', 'box domotique', 'centrale'],
    draw: (c) =>
      rect(4, 10, 56, 42, 5, c.g('dark')) +
      rect(9, 15, 46, 32, 2, c.g('glass'), '') +
      path('M22 36L32 26L42 36V44H22Z', c.g('white'), S('#1e3a8a', 1.2)) +
      rect(29, 38, 6, 6, 1, c.g('blue'), '') +
      shine(10, 16, 20, 4),
  },
  {
    id: 'reseau',
    name: 'Réseau',
    keywords: ['reseau', 'vdi', 'baie', 'switch', 'informatique', 'coffret com'],
    draw: (c) =>
      line(32, 16, 14, 46, '#475569', 2.4) +
      line(32, 16, 50, 46, '#475569', 2.4) +
      line(14, 46, 50, 46, '#475569', 2.4) +
      circle(32, 16, 9, c.g('blue')) +
      circle(14, 46, 9, c.g('sky')) +
      circle(50, 46, 9, c.g('sky')),
  },
  {
    id: 'box-internet',
    name: 'Box internet',
    keywords: ['box', 'internet', 'wifi', 'fibre', 'routeur', 'adsl', 'modem'],
    draw: (c) =>
      rect(6, 34, 52, 18, 5, c.g('dark')) +
      [14, 20, 26].map((x) => circle(x, 43, 1.8, c.g('green'), '')).join('') +
      `<path d="M18 22a20 20 0 0 1 28 0M24 28a11 11 0 0 1 16 0" fill="none" ${S('#0284c7', 2.6)}/>` +
      circle(32, 31, 2, '#0284c7', ''),
  },
  {
    id: 'rj45',
    name: 'RJ45',
    keywords: ['rj45', 'ethernet', 'prise rj45', 'cat6', 'grade'],
    draw: (c) => rect(8, 8, 48, 48, 7, c.g('white')) + path('M18 20H46V40H40V46H24V40H18Z', c.g('dark')) + [23, 27, 31, 35, 39, 43].map((x) => rect(x - 1, 22, 2, 7, 0.5, c.g('amber'), '')).join(''),
  },
  {
    id: 'television',
    name: 'Télévision',
    keywords: ['tv', 'tele', 'television', 'antenne', 'home cinema', 'tnt'],
    draw: (c) => rect(4, 8, 56, 38, 4, c.g('dark')) + rect(8, 12, 48, 30, 2, c.g('blue'), '') + shine(10, 14, 22, 5) + path('M24 46L20 56H44L40 46Z', c.g('gray')),
  },
  {
    id: 'piscine',
    name: 'Piscine',
    keywords: ['piscine', 'bassin'],
    draw: (c) =>
      rect(4, 30, 56, 28, 6, c.g('water')) +
      waves(8, 40, 48, '#e0f2fe') +
      waves(8, 50, 48, '#e0f2fe') +
      `<path d="M20 34V12a6 6 0 0 1 12 0M36 34V12a6 6 0 0 1 12 0" fill="none" ${S('#475569', 3)}/>` +
      line(20, 20, 36, 20, '#475569', 2.4) +
      line(20, 28, 36, 28, '#475569', 2.4),
  },
  {
    id: 'pompe-piscine',
    name: 'Pompe piscine',
    keywords: ['pompe piscine', 'filtration', 'pompe', 'surpresseur', 'relevage'],
    draw: (c) =>
      rect(6, 20, 26, 26, 6, c.g('blue')) +
      rect(30, 24, 20, 18, 4, c.g('steel')) +
      [28, 32, 36].map((y) => line(34, y, 46, y, '#64748b', 1.2)).join('') +
      rect(12, 12, 14, 8, 2, c.g('gray')) +
      rect(4, 46, 50, 5, 2, c.g('gray')) +
      waves(8, 58, 48),
  },
  {
    id: 'spa',
    name: 'Spa',
    keywords: ['spa', 'jacuzzi', 'balneo', 'sauna'],
    draw: (c) =>
      path('M4 30H60V44A12 12 0 0 1 48 56H16A12 12 0 0 1 4 44Z', c.g('white')) +
      rect(8, 30, 48, 8, 3, c.g('water'), '') +
      [18, 28, 38, 46].map((x, i) => circle(x, 18 - (i % 2) * 5, 3 + (i % 2), c.g('sky'), S('#0369a1', 1))).join(''),
  },
  {
    id: 'jardin',
    name: 'Jardin',
    keywords: ['jardin', 'arrosage', 'potager', 'abri', 'serre', 'exterieur jardin'],
    draw: (c) =>
      rect(28, 36, 8, 20, 2, c.g('wood')) +
      circle(32, 26, 16, c.g('leaf')) +
      circle(22, 32, 9, c.g('green')) +
      circle(42, 32, 9, c.g('green')) +
      rect(10, 56, 44, 4, 2, c.g('wood'), ''),
  },
  {
    id: 'sonnette',
    name: 'Sonnette',
    keywords: ['sonnette', 'carillon', 'sonnerie', 'bouton sonnette'],
    draw: (c) =>
      path('M18 44V28A14 14 0 0 1 46 28V44L50 48H14Z', c.g('amber')) +
      circle(32, 52, 4.5, c.g('amber')) +
      rect(30, 8, 4, 6, 2, c.g('amber'), '') +
      `<path d="M8 20q-4 8 0 16M56 20q4 8 0 16" fill="none" ${S('#d97706', 2.4)}/>`,
  },
  {
    id: 'recharge-ve',
    name: 'Recharge véhicule électrique',
    keywords: ['recharge', 'vehicule', 'voiture', 've', 'irve', 'vehicule electrique', 'auto'],
    draw: (c) => car(c, 4, 22, 1.2) + badge(c, 'green', bolt(49, 41, 1.2, c.g('yellow'))),
  },
  {
    id: 'borne-recharge',
    name: 'Borne de recharge',
    keywords: ['borne', 'wallbox', 'borne de recharge', 'borne recharge'],
    draw: (c) =>
      rect(16, 6, 24, 52, 5, c.g('white')) +
      rect(20, 11, 16, 12, 2, c.g('dark')) +
      bolt(28, 12, 0.75, c.g('green')) +
      circle(28, 34, 5, c.g('steel')) +
      `<path d="M33 36q14 2 14 12t10 8" fill="none" ${S('#1f2937', 3)}/>` +
      rect(12, 56, 32, 4, 2, c.g('gray')),
  },
  {
    id: 'differentiel',
    name: 'Différentiel',
    keywords: ['differentiel', 'inter diff', 'interrupteur differentiel', 'id', 'protection', '30ma'],
    draw: (c) =>
      rect(12, 4, 40, 56, 4, c.g('white')) +
      rect(18, 18, 12, 26, 3, c.g('dark')) +
      rect(21, 20, 6, 10, 2, c.g('steel'), '') +
      circle(41, 22, 5, c.g('amber')) +
      `<text x="41" y="25" font-size="7" font-family="Arial" font-weight="700" text-anchor="middle" fill="#1f2937">T</text>` +
      `<text x="38" y="44" font-size="9" font-family="Arial" font-weight="700" text-anchor="middle" fill="#1d4ed8">30mA</text>`,
  },
  {
    id: 'disjoncteur',
    name: 'Disjoncteur',
    keywords: ['disjoncteur', 'general', 'agcp', 'disjoncteur general', 'protection generale'],
    draw: (c) => rect(18, 4, 28, 56, 4, c.g('white')) + rect(26, 20, 12, 24, 3, c.g('dark')) + rect(28, 22, 8, 9, 2, c.g('steel'), '') + bolt(32, 47, 0.55, c.g('yellow')),
  },
  {
    id: 'bureau',
    name: 'Bureau / informatique',
    keywords: ['bureau', 'ordinateur', 'pc bureau', 'informatique bureau', 'imprimante'],
    draw: (c) => rect(6, 8, 52, 34, 4, c.g('dark')) + rect(10, 12, 44, 26, 2, c.g('sky'), '') + shine(12, 14, 18, 4) + path('M26 42L22 54H42L38 42Z', c.g('gray')) + rect(14, 54, 36, 4, 2, c.g('gray')),
  },
  {
    id: 'cuisine',
    name: 'Cuisine',
    keywords: ['cuisine', 'kitchen', 'cuisson generale'],
    draw: (c) => `<ellipse cx="30" cy="42" rx="22" ry="12" fill="${c.g('steel')}" ${OUT}/>` + path('M8 36H52V42A22 12 0 0 1 8 42Z', c.g('dark')) + rect(50, 36, 12, 5, 2.5, c.g('dark')) + `<path d="M22 26q-3 -5 0 -10M30 26q-3 -5 0 -10M38 26q-3 -5 0 -10" fill="none" ${S('#94a3b8', 2)}/>`,
  },
];

const ICON_BY_ID = new Map(LABEL_ICONS.map((i) => [i.id, i]));

export function getIcon(id: string | null | undefined): IconDef | undefined {
  return id ? ICON_BY_ID.get(id) : undefined;
}

/**
 * Contenu SVG d'une icône (viewBox 0 0 64 64), avec des identifiants de dégradés
 * uniques (`uid`) pour pouvoir placer plusieurs icônes dans un même document.
 */
export function iconMarkup(id: string, uid: string): string {
  const def = ICON_BY_ID.get(id);
  if (!def) return '';
  const used = new Set<ToneKey>();
  const ctx: Ctx = {
    g: (tone) => {
      used.add(tone);
      return `url(#${uid}-${tone})`;
    },
  };
  const body = def.draw(ctx);
  const grads = [...used]
    .map((t) => {
      const [a, b] = PALETTE[t];
      return `<linearGradient id="${uid}-${t}" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    })
    .join('');
  const shadow = `<filter id="${uid}-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.3" flood-color="#0f172a" flood-opacity="0.35"/></filter>`;
  return `<defs>${grads}${shadow}</defs><g filter="url(#${uid}-sh)">${body}</g>`;
}

/** Document SVG autonome d'une icône. */
export function iconSvg(id: string, size: number, uid = `ic-${id}`): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${iconMarkup(id, uid)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Suggestion automatique texte → icône                                */
/* ------------------------------------------------------------------ */

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Icônes correspondant au texte d'une étiquette, la plus pertinente en premier.
 * « Four » → four, « Lave-linge » → lave-linge, « VMC » → vmc, « Plaque » → plaque.
 */
export function suggestIcons(text: string, limit = 6): IconDef[] {
  const t = normalizeText(text);
  if (!t) return [];
  const words = t.split(' ');
  const scored: { def: IconDef; score: number }[] = [];
  for (const def of LABEL_ICONS) {
    let score = 0;
    for (const kw of def.keywords) {
      const k = normalizeText(kw);
      if (!k) continue;
      if (t === k) score = Math.max(score, 100 + k.length);
      else if (k.includes(' ') ? ` ${t} `.includes(` ${k} `) : words.includes(k)) score = Math.max(score, 60 + k.length);
      else if (k.length >= 3 && words.some((w) => w.length >= 3 && (w.startsWith(k) || k.startsWith(w)))) score = Math.max(score, 30 + Math.min(k.length, 10));
    }
    if (score > 0) scored.push({ def, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.def);
}

export function suggestIcon(text: string): string | null {
  return suggestIcons(text, 1)[0]?.id ?? null;
}
