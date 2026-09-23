/**
 * Encodage ESC/POS minimal pour impression raster (imprimantes thermiques compatibles).
 * Aucune donnée n'est envoyée ici : ce module ne fait que construire les octets.
 */

export interface MonoBitmap {
  /** Largeur en points (multiple de 8 conseillé). */
  width: number;
  height: number;
  /** 1 bit par point, lignes de ceil(width / 8) octets, bit de poids fort à gauche. 1 = noir. */
  data: Uint8Array;
}

/** Convertit des pixels RGBA en bitmap 1 bit (seuil sur la luminance). */
export function rgbaToMono(rgba: Uint8ClampedArray, width: number, height: number, threshold = 160): MonoBitmap {
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3] / 255;
      const lum = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width: bytesPerRow * 8, height, data };
}

/** Commandes : initialisation + image raster (GS v 0) par bandes + avance papier. */
export function encodeRasterJob(bmp: MonoBitmap, feedLines = 4, bandRows = 128): Uint8Array {
  const bytesPerRow = bmp.width / 8;
  const parts: number[] = [0x1b, 0x40]; // ESC @
  for (let y = 0; y < bmp.height; y += bandRows) {
    const rows = Math.min(bandRows, bmp.height - y);
    parts.push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff);
    const start = y * bytesPerRow;
    for (let i = 0; i < rows * bytesPerRow; i++) parts.push(bmp.data[start + i]);
  }
  parts.push(0x1b, 0x64, feedLines); // ESC d n
  return Uint8Array.from(parts);
}
