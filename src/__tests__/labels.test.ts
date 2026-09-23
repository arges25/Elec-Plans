import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PANEL_TEMPLATES,
  HAGER_GAMMA_13,
  LEGRAND_DRIVIA_13,
  SCHNEIDER_RESI9_13,
  cellWidthMm,
  computeRowWidthMm,
  duplicateTemplate,
  validateTemplate,
} from '../data/electricalPanelTemplates';
import { approxMeasure, buildLabelStrips, fitLabelText, PT_TO_MM, stripSizeMm } from '../utils/labelLayout';
import type { ElectricalCircuit } from '../types';

describe('Modèles d’étiquettes (source unique)', () => {
  it('Legrand Drivia 13 : 13 × 17,5 = 227,5 mm', () => {
    expect(LEGRAND_DRIVIA_13.modulesPerRow).toBe(13);
    expect(LEGRAND_DRIVIA_13.modulePitchMm).toBe(17.5);
    expect(LEGRAND_DRIVIA_13.rowWidthMm).toBe(227.5);
    expect(computeRowWidthMm(LEGRAND_DRIVIA_13.modulesPerRow, LEGRAND_DRIVIA_13.modulePitchMm)).toBe(227.5);
  });

  it('Schneider Resi9 13 : 13 × 18 = 234 mm', () => {
    expect(SCHNEIDER_RESI9_13.modulesPerRow).toBe(13);
    expect(SCHNEIDER_RESI9_13.modulePitchMm).toBe(18);
    expect(SCHNEIDER_RESI9_13.rowWidthMm).toBe(234);
  });

  it('Hager Gamma+ 13 : 13 × 17,5 = 227,5 mm', () => {
    expect(HAGER_GAMMA_13.modulesPerRow).toBe(13);
    expect(HAGER_GAMMA_13.modulePitchMm).toBe(17.5);
    expect(HAGER_GAMMA_13.rowWidthMm).toBe(227.5);
  });

  it('les 3 modèles intégrés sont valides et la hauteur reste modifiable', () => {
    for (const t of BUILTIN_PANEL_TEMPLATES) {
      expect(validateTemplate(t)).toEqual([]);
      const custom = duplicateTemplate(t, 'x', 'Perso garage');
      custom.labelHeightMm = 15.5;
      expect(custom.builtIn).toBe(false);
      expect(validateTemplate(custom)).toEqual([]);
    }
  });

  it('signale une largeur totale incohérente', () => {
    const bad = { ...LEGRAND_DRIVIA_13, rowWidthMm: 200 };
    expect(validateTemplate(bad).some((i) => i.field === 'rowWidthMm')).toBe(true);
  });
});

describe('Calcul de largeur d’étiquette', () => {
  it('largeur d’une case = modules × pas', () => {
    expect(cellWidthMm(LEGRAND_DRIVIA_13, 1)).toBe(17.5);
    expect(cellWidthMm(LEGRAND_DRIVIA_13, 2)).toBe(35);
    expect(cellWidthMm(SCHNEIDER_RESI9_13, 2)).toBe(36);
    expect(cellWidthMm(HAGER_GAMMA_13, 4)).toBe(70);
  });

  it('positionne les cases d’une rangée et détecte le dépassement', () => {
    const mk = (i: number, modules: number): ElectricalCircuit => ({
      id: `c${i}`,
      panelId: 'p',
      rowId: 'r1',
      order: i,
      number: String(i),
      name: `Circuit ${i}`,
      kind: 'circuit',
      modules,
      protection: 'C16',
      cableSection: '2,5 mm²',
    });
    const circuits = [mk(0, 2), ...Array.from({ length: 12 }, (_, i) => mk(i + 1, 1))];
    const [strip] = buildLabelStrips([{ id: 'r1', name: 'Rangée 1' }], circuits, [], SCHNEIDER_RESI9_13);
    expect(strip.cells[1].xMm).toBe(36);
    expect(strip.cells[2].xMm).toBe(54);
    expect(strip.usedModules).toBe(14);
    expect(strip.overflow).toBe(1);
  });

  it('dimensions extérieures d’une bande avec marges', () => {
    const t = { ...LEGRAND_DRIVIA_13, marginLeftMm: 2, marginRightMm: 3, marginTopMm: 1, marginBottomMm: 1, labelHeightMm: 12 };
    expect(stripSizeMm(t)).toEqual({ width: 232.5, height: 14 });
  });
});

describe('Ajustement du texte (jamais hors de la case)', () => {
  it('garde le texte court sur une ligne à la taille de base', () => {
    const r = fitLabelText('Four', 17.5, 8, 7, 2, approxMeasure);
    expect(r.lines).toEqual(['Four']);
    expect(r.fontSizePt).toBe(7);
  });

  it('passe sur 2 lignes et/ou réduit la police pour un texte long', () => {
    const r = fitLabelText('Prises cuisine plan de travail', 17.5, 8, 7, 2, approxMeasure);
    expect(r.lines.length).toBeLessThanOrEqual(2);
    for (const l of r.lines) expect(approxMeasure(l, r.fontSizePt, true)).toBeLessThanOrEqual(17.5 + 1e-6);
    expect(r.lines.length * r.fontSizePt * PT_TO_MM * 1.12).toBeLessThanOrEqual(8 + 1e-6);
  });

  it('tronque en dernier recours sans dépasser', () => {
    const r = fitLabelText('Anticonstitutionnellement électrique extérieur jardin', 10, 4, 7, 1, approxMeasure);
    expect(r.truncated).toBe(true);
    expect(r.lines).toHaveLength(1);
    expect(approxMeasure(r.lines[0], r.fontSizePt, true)).toBeLessThanOrEqual(10 + 1e-6);
  });
});
