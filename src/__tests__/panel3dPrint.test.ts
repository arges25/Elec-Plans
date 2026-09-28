import { describe, expect, it } from 'vitest';
import type { PlacedDevice } from '../features/panel3d/types';
import { createPanelProject } from '../features/panel3d/store/projectFactory';
import { labelZones } from '../features/panel3d/engine/placement';
import { layoutLabel } from '../features/panel3d/render/LabelCell';
import {
  CALIBRATION_LENGTH_MM,
  correctionFromMeasure,
  layoutSheet,
  panelHeader,
  percentToScale,
  pieceCaption,
  splitRow,
  stripPieces,
} from '../features/panel3d/print/labelSheet';

const dev = (id: string, row: number, start: number, width = 1, extra: Partial<PlacedDevice> = {}): PlacedDevice => ({
  id,
  manufacturer: 'legrand',
  productId: 'legrand-breaker-C-16',
  row,
  startModule: start,
  moduleWidth: width,
  label: '',
  icon: null,
  labelStyle: null,
  mergedWithPrev: false,
  linkedComponents: [],
  ...extra,
});

describe('Impression des étiquettes en millimètres', () => {
  it('13 modules : bandeau de 234 mm, A4 paysage, zones à la largeur des appareils', () => {
    const p = { ...createPanelProject('Maison', 'legrand'), enclosureId: 'legrand-drivia13-2r' };
    p.devices = [dev('a', 0, 0, 2, { label: 'Différentiel' }), dev('b', 0, 2, 1, { label: 'Four', icon: 'four' }), dev('c', 1, 4.5, 2.5)];
    const sheet = layoutSheet(p);
    expect(sheet.orientation).toBe('landscape');
    expect(sheet.pageWidthMm).toBe(297);
    const strips = sheet.pages.flat();
    expect(strips).toHaveLength(2);
    expect(strips[0].piece.widthMm).toBe(13 * 18);
    expect(strips[0].piece.zones.map((z) => [z.x, z.w])).toEqual([
      [0, 36],
      [36, 18],
    ]);
    // Prise 2,5 modules en position 4,5 : 45 mm de large à 81 mm du bord
    expect(strips[1].piece.zones[0]).toMatchObject({ x: 81, w: 45 });
  });

  it('18 modules (324 mm) : bandeau coupé entre deux étiquettes', () => {
    const p = { ...createPanelProject('Grand', 'legrand'), enclosureId: 'legrand-drivia18-4r' };
    // Différentiel à cheval sur la limite de 15 modules (277 mm / 18 mm)
    p.devices = [dev('a', 0, 0, 14), dev('b', 0, 14, 2), dev('c', 0, 16, 2)];
    const pieces = stripPieces(p, 277);
    const row0 = pieces.filter((x) => x.row === 0);
    expect(row0.map((x) => [x.startModule, x.endModule])).toEqual([
      [0, 14],
      [14, 18],
    ]);
    expect(pieceCaption(row0[1])).toBe('Rangée 1 (2/2)');
    // Aucune étiquette n'est coupée
    for (const piece of row0) for (const z of piece.zones) expect(z.x + z.w).toBeLessThanOrEqual(piece.widthMm + 1e-9);
  });

  it('découpe franche seulement si une étiquette est plus large que la page', () => {
    const zones = labelZones([dev('a', 0, 0, 18)], 0, 'both');
    expect(splitRow(zones, 18, 15)).toEqual([
      [0, 15],
      [15, 18],
    ]);
  });

  it('la correction d’échelle réduit la place disponible et reste en %', () => {
    expect(correctionFromMeasure(49.4)).toBeCloseTo(1.21, 2);
    expect(correctionFromMeasure(CALIBRATION_LENGTH_MM)).toBe(0);
    // Règle imprimée avec +1,21 % puis mesurée 50,1 mm : correction composée
    expect(correctionFromMeasure(50.1, 1.21)).toBeCloseTo(1.01, 2);
    expect(() => correctionFromMeasure(30)).toThrow();
    expect(percentToScale(2)).toBeCloseTo(1.02, 10);
  });

  it('en-tête : projet, marque, gamme et référence (jamais inventée)', () => {
    const p = { ...createPanelProject('Maison Martin', 'schneider'), enclosureId: 'schneider-resi9-13-2r' };
    expect(panelHeader(p)).toBe('Maison Martin — Schneider Electric Resi9 coffret en saillie 2 rangées de 13 modules — R9H13402');
  });
});

describe('Disposition texte + icône d’une étiquette', () => {
  it('1 module : icône au-dessus du texte, le tout dans la case', () => {
    const lay = layoutLabel(18, 12, 'Lave-linge', 'lave-linge', 'both', 8);
    expect(lay.icon!.y + lay.icon!.size).toBeLessThanOrEqual(lay.text!.y);
    expect(lay.icon!.size).toBeLessThanOrEqual(12);
  });
  it('zone large : icône à gauche, texte à droite', () => {
    const lay = layoutLabel(54, 12, 'Éclairage séjour', 'eclairage', 'both', 8);
    expect(lay.icon!.x).toBeLessThan(2);
    expect(lay.text!.x).toBeGreaterThan(lay.icon!.x + lay.icon!.size);
  });
  it('styles texte seul / icône seule', () => {
    expect(layoutLabel(18, 12, 'Four', 'four', 'text', 8).icon).toBeNull();
    expect(layoutLabel(18, 12, 'Four', 'four', 'icon', 8).text).toBeNull();
  });
});
