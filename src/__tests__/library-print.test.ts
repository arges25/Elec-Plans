import { describe, expect, it } from 'vitest';
import { ELECTRICAL_SYMBOLS, LIBRARY_FILTERS, getSymbolDefinition, searchSymbols } from '../data/electricalSymbols';
import { encodeRasterJob, rgbaToMono } from '../services/printerService/escpos';
import { applyHomography, computeHomography, type Quad } from '../services/imageProcessing';
import { buildLegend } from '../utils/legend';
import { buildDemoBundle } from '../data/demoProject';

describe('Bibliothèque électrique', () => {
  it('contient au moins 120 symboles aux identifiants uniques', () => {
    expect(ELECTRICAL_SYMBOLS.length).toBeGreaterThanOrEqual(120);
    const ids = new Set(ELECTRICAL_SYMBOLS.map((s) => s.id));
    expect(ids.size).toBe(ELECTRICAL_SYMBOLS.length);
    for (const s of ELECTRICAL_SYMBOLS) {
      expect(s.svg.startsWith('<svg')).toBe(true);
      expect(s.name && s.category && s.subCategory && s.color).toBeTruthy();
      expect(s.defaultSize).toBeGreaterThan(0);
    }
  });

  it('recherche « RJ45 » (insensible aux accents / casse)', () => {
    const r = searchSymbols('rj45');
    expect(r[0].name).toMatch(/RJ45/);
    expect(searchSymbols('va et vient')[0].id).toBe('va-et-vient');
    expect(searchSymbols('SECHE LINGE')[0].id).toBe('seche-linge');
  });

  it('filtres de catégories et repli pour un symbole inconnu', () => {
    expect(LIBRARY_FILTERS.map((f) => f.label)).toEqual([
      'Tous',
      'Favoris',
      'Prises',
      'Commandes',
      'Éclairage',
      'Ventilation',
      'Chauffage',
      'Réseau',
      'Sécurité',
      'Domotique',
      'Tableau',
      'Autres',
    ]);
    expect(getSymbolDefinition('n-existe-pas').id).toBe('inconnu');
  });

  it('légende automatique de la Maison Démo', () => {
    const legend = buildLegend(buildDemoBundle().symbols);
    const sockets = legend.find((e) => e.def.id === 'prise-16a');
    expect(sockets?.count).toBeGreaterThan(5);
  });
});

describe('Impression ESC/POS (encodage)', () => {
  it('convertit en bitmap 1 bit et encode GS v 0', () => {
    const w = 8;
    const h = 2;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
    rgba.set([0, 0, 0, 255], 0); // pixel (0,0) noir
    const bmp = rgbaToMono(rgba, w, h);
    expect(bmp.data[0]).toBe(0x80);
    const job = encodeRasterJob(bmp, 2);
    expect(Array.from(job.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(job.slice(2, 10))).toEqual([0x1d, 0x76, 0x30, 0x00, 1, 0, 2, 0]);
  });
});

describe('Redressement de perspective', () => {
  it('l’homographie envoie les 4 coins sur le rectangle', () => {
    const src: Quad = [
      { x: 10, y: 20 },
      { x: 400, y: 5 },
      { x: 420, y: 300 },
      { x: 0, y: 280 },
    ];
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 399, y: 0 },
      { x: 399, y: 299 },
      { x: 0, y: 299 },
    ];
    const h = computeHomography(src, dst);
    for (let i = 0; i < 4; i++) {
      const p = applyHomography(h, src[i].x, src[i].y);
      expect(p.x).toBeCloseTo(dst[i].x, 6);
      expect(p.y).toBeCloseTo(dst[i].y, 6);
    }
  });
});
