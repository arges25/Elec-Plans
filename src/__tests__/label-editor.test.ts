import { describe, expect, it } from 'vitest';
import type { ElectricalCircuit, ElectricalPanel } from '../types';
import { BUILTIN_PANEL_TEMPLATES, LEGRAND_DRIVIA_13, builtinTemplate, validateTemplate } from '../data/electricalPanelTemplates';
import { applyTemplateChanges, createCase, duplicateRow, moveCase, newPanelRow, placeCase, rowCases, usedModules } from '../utils/labelEditor';
import { approxMeasure, buildLabelStrips } from '../utils/labelLayout';
import { layoutStrip } from '../services/labels/labelRender';

const panel: ElectricalPanel = {
  id: 'p',
  projectId: null,
  name: 'Garage',
  templateId: LEGRAND_DRIVIA_13.id,
  rows: [
    { id: 'r1', name: 'Rangée 1' },
    { id: 'r2', name: 'Rangée 2' },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const mk = (id: string, rowId: string, order: number, name: string, number = String(order + 1), modules = 1): ElectricalCircuit => ({
  id,
  panelId: 'p',
  rowId,
  order,
  number,
  name,
  kind: 'circuit',
  modules,
  protection: 'C16',
  cableSection: '2,5 mm²',
});

const example = [
  mk('a', 'r1', 0, 'Éclairage cuisine'),
  mk('b', 'r1', 1, 'Prises cuisine'),
  mk('c', 'r1', 2, 'Four'),
  mk('d', 'r1', 3, 'Lave-vaisselle'),
  mk('e', 'r1', 4, 'Chauffe-eau'),
];

describe('Éditeur d’étiquettes', () => {
  it('exemple : disjoncteurs 1 à 5 → cases de l’aperçu dans l’ordre', () => {
    const [strip] = buildLabelStrips(panel.rows, example, [], LEGRAND_DRIVIA_13);
    expect(strip.cells.map((c) => `${c.number} ${c.text}`)).toEqual([
      '1 Éclairage cuisine',
      '2 Prises cuisine',
      '3 Four',
      '4 Lave-vaisselle',
      '5 Chauffe-eau',
    ]);
    expect(strip.cells[4].xMm).toBe(70);
  });

  it('ajouter une case : numéro suivant, en fin de ligne, pictogramme deviné', () => {
    const c = createCase(panel, 'r1', example, 'Sèche-linge');
    expect(c.number).toBe('6');
    expect(c.order).toBe(5);
    expect(c.icon).toBe('seche-linge');
    expect(createCase(panel, 'r2', example).name).toBe('Circuit 6');
  });

  it('réorganiser : déplacer à gauche / à droite, glisser vers une autre ligne', () => {
    const changed = moveCase(example, 'c', -1);
    const merged = example.map((x) => changed.find((y) => y.id === x.id) ?? x);
    expect(rowCases(merged, 'r1').map((x) => x.id)).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(moveCase(example, 'a', -1)).toEqual([]);
    expect(moveCase(example, 'e', 1)).toEqual([]);
    const moved = placeCase(example, 'b', 'r2', 0);
    const after = example.map((x) => moved.find((y) => y.id === x.id) ?? x);
    expect(rowCases(after, 'r2').map((x) => x.id)).toEqual(['b']);
    expect(rowCases(after, 'r1').map((x) => x.order)).toEqual([0, 1, 2, 3]);
  });

  it('dupliquer une ligne : nouvelle ligne juste après, cases copiées et renumérotées', () => {
    const r = duplicateRow(panel, example, 'r1')!;
    expect(r.rows.map((x) => x.id)).toEqual(['r1', r.row.id, 'r2']);
    expect(r.row.name).toBe('Rangée 1 (copie)');
    expect(r.copies.map((c) => c.name)).toEqual(example.map((c) => c.name));
    expect(r.copies.map((c) => c.number)).toEqual(['6', '7', '8', '9', '10']);
    expect(new Set(r.copies.map((c) => c.id)).size).toBe(5);
    expect(newPanelRow(panel.rows).name).toBe('Rangée 3');
  });

  it('réglages du modèle : largeur, hauteur, modules, taille et alignement du texte', () => {
    const t = applyTemplateChanges(LEGRAND_DRIVIA_13, { modulesPerRow: 18, modulePitchMm: 18, labelHeightMm: 15, fontSizePt: 9, textAlign: 'left' });
    expect(t.rowWidthMm).toBe(324);
    expect(validateTemplate(t)).toEqual([]);
    // Valeurs hors limites ramenées dans des bornes valides
    const clamped = applyTemplateChanges(LEGRAND_DRIVIA_13, { modulesPerRow: 0, fontSizePt: 99, labelHeightMm: 1 });
    expect(validateTemplate(clamped)).toEqual([]);
    // L'aperçu applique immédiatement alignement et taille du texte
    const [strip] = buildLabelStrips(panel.rows, example, [], t);
    const texts = layoutStrip(strip, t, approxMeasure).filter((p) => p.t === 'text' && p.text === 'Four');
    expect(texts[0]).toMatchObject({ anchor: 'start' });
    expect(usedModules(example, 'r1')).toBe(5);
  });

  it('modèles intégrés Legrand / Schneider / Hager en 13 et 18 modules', () => {
    for (const brand of ['Legrand', 'Schneider', 'Hager']) {
      const mods = BUILTIN_PANEL_TEMPLATES.filter((t) => t.brand === brand).map((t) => t.modulesPerRow);
      expect(mods).toEqual([13, 18]);
    }
    for (const t of BUILTIN_PANEL_TEMPLATES) expect(validateTemplate(t)).toEqual([]);
    expect(builtinTemplate('schneider-resi9-18')?.rowWidthMm).toBe(324);
    expect(builtinTemplate('perso')).toBeUndefined();
  });
});
