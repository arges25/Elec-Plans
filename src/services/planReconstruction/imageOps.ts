/**
 * Opérations d'image pures (sans DOM) : niveaux de gris, seuillage adaptatif.
 * Utilisées par le scanner (noir et blanc) et par la détection de croquis (repli sans OpenCV).
 */

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return out;
}

/** Image intégrale (sommes cumulées) de taille (w+1) × (h+1). */
export function integralImage(gray: Uint8Array, width: number, height: number): Float64Array {
  const w1 = width + 1;
  const ii = new Float64Array(w1 * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      ii[y * w1 + x] = ii[(y - 1) * w1 + x] + rowSum;
    }
  }
  return ii;
}

/**
 * Seuillage adaptatif par moyenne locale.
 * Retourne un masque : 1 = trait sombre (encre), 0 = fond.
 * @param block taille de la fenêtre (pixels)
 * @param c pourcentage sous la moyenne locale pour être considéré comme trait (ex. 10 = 10 %)
 */
export function adaptiveThreshold(gray: Uint8Array, width: number, height: number, block: number, c: number): Uint8Array {
  const ii = integralImage(gray, width, height);
  const w1 = width + 1;
  const half = Math.max(1, Math.floor(block / 2));
  const out = new Uint8Array(width * height);
  const k = 1 - c / 100;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum = ii[y1 * w1 + x1] - ii[y0 * w1 + x1] - ii[y1 * w1 + x0] + ii[y0 * w1 + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = gray[y * width + x] < mean * k ? 1 : 0;
    }
  }
  return out;
}

/** Applique un rendu « scan » noir et blanc (seuillage adaptatif) sur des pixels RGBA. */
export function applyAdaptiveBlackWhite(rgba: Uint8ClampedArray, width: number, height: number, sensitivity: number): void {
  const gray = toGray(rgba, width, height);
  const block = Math.max(15, Math.round(Math.min(width, height) / 30) | 1);
  const mask = adaptiveThreshold(gray, width, height, block, sensitivity);
  for (let j = 0, i = 0; j < mask.length; j++, i += 4) {
    const v = mask[j] ? 0 : 255;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
  }
}

/** Dilatation binaire (filtre max séparable, rayon r) : épaissit les traits pour tolérer le tracé à main levée. */
export function dilateMask(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const row = y * width;
    for (let x = 0; x < Math.min(r, width); x++) count += mask[row + x];
    for (let x = 0; x < width; x++) {
      if (x + r < width) count += mask[row + x + r];
      if (x - r - 1 >= 0) count -= mask[row + x - r - 1];
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(r, height); y++) count += tmp[y * width + x];
    for (let y = 0; y < height; y++) {
      if (y + r < height) count += tmp[(y + r) * width + x];
      if (y - r - 1 >= 0) count -= tmp[(y - r - 1) * width + x];
      out[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}
