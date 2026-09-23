/** Génère un croquis synthétique (traits légèrement irréguliers) pour les tests. */
export function makeSketch(width = 800, height = 600): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4).fill(235);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dot = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const o = (py * width + px) * 4;
        data[o] = data[o + 1] = data[o + 2] = 40;
      }
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    let wob = 0;
    for (let s = 0; s <= len; s += 0.5) {
      wob += (rnd() - 0.5) * 0.3;
      wob = Math.max(-2, Math.min(2, wob));
      const t = s / len;
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      dot(x1 + (x2 - x1) * t + nx * wob, y1 + (y2 - y1) * t + ny * wob, 1);
    }
  };
  // Contour
  line(100, 100, 700, 102);
  line(700, 102, 698, 500);
  line(698, 500, 100, 498);
  line(100, 498, 100, 100);
  // Cloison verticale avec une porte (écart 250 → 310)
  line(400, 101, 401, 250);
  line(401, 310, 400, 499);
  // Cloison horizontale partielle
  line(100, 300, 400, 301);
  // « Texte » parasite
  for (let i = 0; i < 6; i++) dot(200 + i * 9, 200 + (i % 2) * 4, 2);
  return { data, width, height };
}
