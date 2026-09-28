import { beforeEach, describe, expect, it } from 'vitest';
import type { PlacedDevice } from '../features/panel3d/types';
import {
  MANUFACTURERS,
  equivalentProduct,
  findEnclosure,
  formatDimensions,
  getEnclosure,
  listDevices,
  modulesOptions,
  rowsOptions,
} from '../features/panel3d/data/catalog';
import { DIN_MODULE_MM, NOT_PROVIDED } from '../features/panel3d/constants';
import {
  autoArrange,
  canPlace,
  dropTarget,
  duplicateSlot,
  firstFreeSlot,
  freeIntervals,
  labelZones,
  nearestFreeStart,
  withLinkedComponents,
} from '../features/panel3d/engine/placement';
import { boardGeometry, hitTest } from '../features/panel3d/engine/geometry';
import { buildBom } from '../features/panel3d/engine/bom';
import { suggestIcon, suggestIcons, LABEL_ICONS, iconMarkup } from '../features/panel3d/render/icons';
import { usePanelEditor } from '../features/panel3d/store/panelEditorStore';
import { createPanelProject } from '../features/panel3d/store/projectFactory';

const dev = (id: string, row: number, start: number, width = 1, extra: Partial<PlacedDevice> = {}): PlacedDevice => ({
  id,
  manufacturer: 'legrand',
  productId: 'legrand-breaker-C-16',
  row,
  startModule: start,
  moduleWidth: width,
  circuitRef: '',
  label: '',
  shortLabel: '',
  icon: null,
  labelStyle: null,
  notes: '',
  mergedWithPrev: false,
  linkedComponents: [],
  ...extra,
});
const cap13 = { rows: 2, modulesPerRow: 13 };

describe('Bibliothèques fabricants', () => {
  it('Legrand Drivia 13 : dimensions officielles 250 × 250/375/500/625 × 103,5 mm', () => {
    const h = [250, 375, 500, 625];
    for (let r = 1; r <= 4; r++) {
      const e = findEnclosure('legrand', 'Drivia', 13, r)!;
      expect(e.dimensions).toEqual({ widthMm: 250, heightMm: h[r - 1], depthMm: 103.5 });
      expect(e.totalModules).toBe(13 * r);
      expect(e.reference).toBe(`40121${r}`);
    }
    expect(formatDimensions(getEnclosure('legrand-drivia13-4r')!.dimensions)).toBe('250 × 625 × 103,5 mm');
  });

  it('Drivia 18 et Gamma+ 18 : seule la référence 4 rangées vérifiée est proposée', () => {
    expect(rowsOptions('legrand', 'Drivia', 18)).toEqual([4]);
    expect(findEnclosure('legrand', 'Drivia', 18, 4)!.dimensions).toEqual({ widthMm: 355, heightMm: 625, depthMm: 103.5 });
    expect(rowsOptions('hager', 'Gamma+', 18)).toEqual([4]);
    expect(findEnclosure('hager', 'Gamma+', 18, 4)!.dimensions).toEqual({ widthMm: 355, heightMm: 625, depthMm: 103 });
    expect(findEnclosure('hager', 'Gamma+', 13, 3)!.dimensions).toEqual({ widthMm: 250, heightMm: 500, depthMm: 103 });
  });

  it('Schneider Resi9 : 13 et 18 modules, 1 à 4 rangées, dimensions non renseignées (jamais extrapolées)', () => {
    expect(modulesOptions('schneider', 'Resi9')).toEqual([13, 18]);
    expect(rowsOptions('schneider', 'Resi9', 13)).toEqual([1, 2, 3, 4]);
    const r = findEnclosure('schneider', 'Resi9', 13, 1)!;
    expect(r.reference).toBe('R9H13401');
    expect(r.dimensions).toBeNull();
    expect(formatDimensions(r.dimensions)).toBe(NOT_PROVIDED);
    for (const e of MANUFACTURERS.schneider.enclosures) expect(e.dimensions).toBeNull();
  });

  it('chaque coffret est tracé (source, lien, date) et les appareils non vérifiés n’ont pas de référence', () => {
    for (const m of Object.values(MANUFACTURERS)) {
      for (const e of m.enclosures) {
        expect(e.sourceName && e.sourceUrl && e.lastVerified).toBeTruthy();
        expect(e.totalModules).toBe(e.rows * e.modulesPerRow);
      }
      for (const d of m.devices) {
        if (!d.verified) expect(d.reference).toBeNull();
        expect((d.modules * 2) % 1).toBe(0);
        expect(d.brand).toBe(m.brand);
      }
    }
    expect(DIN_MODULE_MM).toBe(18);
  });

  it('marques non mélangées par défaut, conversion par équivalence', () => {
    expect(listDevices('schneider').every((d) => d.brand === 'schneider')).toBe(true);
    expect(listDevices('schneider', true).some((d) => d.brand === 'legrand')).toBe(true);
    const eq = equivalentProduct('legrand-breaker-C-16', 'hager')!;
    expect(eq.id).toBe('hager-breaker-C-16');
    expect(eq.rating).toBe(16);
    expect(MANUFACTURERS.legrand.devices.find((d) => d.kind === 'socket')!.modules).toBe(2.5);
  });
});

describe('Moteur de placement (rail DIN)', () => {
  it('interdit chevauchement, dépassement et 14e module sur une rangée de 13', () => {
    const devices = [dev('a', 0, 0, 2), dev('b', 0, 2)];
    expect(canPlace(devices, cap13, 0, 1, 1).reason).toBe('overlap');
    expect(canPlace(devices, cap13, 0, 12.5, 1).reason).toBe('overflow');
    expect(canPlace(devices, cap13, 0, 3, 1).ok).toBe(true);
    const full = Array.from({ length: 13 }, (_, i) => dev(`d${i}`, 0, i));
    expect(canPlace(full, cap13, 0, 0, 1).reason).toBe('row-full');
    expect(canPlace(full, cap13, 1, 0, 1).ok).toBe(true);
    expect(canPlace(full, cap13, 2, 0, 1).reason).toBe('bad-row');
  });

  it('appareil de 2 modules = 2 cases consécutives, grille au demi-module (prise 2,5 modules)', () => {
    const t = dropTarget([], cap13, 0, 3.26, 2);
    expect(t.start).toBe(3.5);
    expect(t.check.ok).toBe(true);
    const devices = [dev('s', 0, 0, 2.5)];
    expect(freeIntervals(devices, cap13, 0)).toEqual([[2.5, 13]]);
    expect(nearestFreeStart(devices, cap13, 0, 1, 1)).toBe(2.5);
    expect(dropTarget(devices, cap13, 0, 12.8, 2).start).toBe(11);
  });

  it('premier emplacement libre, duplication à droite puis rangée suivante', () => {
    const devices = Array.from({ length: 12 }, (_, i) => dev(`d${i}`, 0, i));
    expect(firstFreeSlot(devices, cap13, 1)).toEqual({ row: 0, start: 12 });
    expect(firstFreeSlot(devices, cap13, 2)).toEqual({ row: 1, start: 0 });
    expect(duplicateSlot(devices, cap13, devices[11])).toEqual({ row: 0, start: 12 });
    const full = [...devices, dev('d12', 0, 12)];
    expect(duplicateSlot(full, cap13, full[12])).toEqual({ row: 1, start: 0 });
  });

  it('organisation automatique : serrés à gauche, passage à la rangée suivante', () => {
    const devices = [dev('a', 0, 5, 2), dev('b', 0, 9, 6), dev('c', 1, 4, 6)];
    const out = autoArrange(devices, cap13)!;
    expect(out.map((d) => [d.id, d.row, d.startModule])).toEqual([
      ['a', 0, 0],
      ['b', 0, 2],
      ['c', 1, 0],
    ]);
    expect(autoArrange([dev('x', 0, 0, 13), dev('y', 1, 0, 13), dev('z', 1, 0, 1)], cap13)).toBeNull();
  });

  it('zones d’étiquette alignées sur les appareils, fusion et séparation', () => {
    const devices = withLinkedComponents([
      dev('id', 0, 0, 2, { label: 'Différentiel' }),
      dev('c1', 0, 2, 1, { label: 'Lumières' }),
      dev('c2', 0, 3, 1, { label: 'Four', mergedWithPrev: true }),
      dev('c3', 0, 5, 1, { mergedWithPrev: true }),
    ]);
    const zones = labelZones(devices, 0, 'both');
    expect(zones.map((z) => [z.leaderId, z.start, z.width])).toEqual([
      ['id', 0, 2],
      ['c1', 2, 2],
      ['c3', 5, 1],
    ]);
    expect(zones[1].label).toBe('Lumières');
    // La fusion d'un appareil non contigu est annulée
    expect(devices.find((d) => d.id === 'c3')!.mergedWithPrev).toBe(false);
    expect(devices.find((d) => d.id === 'c1')!.linkedComponents).toEqual(['c2']);
  });
});

describe('Géométrie aux vraies proportions', () => {
  it('Drivia 13 4 rangées : 250 × 625 mm, fenêtre de 13 × 18 mm centrée', () => {
    const g = boardGeometry(getEnclosure('legrand-drivia13-4r')!);
    expect(g.measured).toBe(true);
    expect([g.widthMm, g.heightMm]).toEqual([250, 625]);
    expect(g.windowWidth).toBe(234);
    expect(g.windowX).toBe(8);
    expect(g.rowGeo).toHaveLength(4);
    // Étiquette au-dessus des appareils
    for (const r of g.rowGeo) expect(r.labelY + r.labelH).toBeLessThan(r.deviceY);
    expect(g.rowGeo[3].openY + g.rowGeo[3].openH).toBeLessThan(625);
    const hit = hitTest(g, g.windowX + 3.5 * 18, g.rowGeo[1].deviceY + 10)!;
    expect(hit.row).toBe(1);
    expect(hit.module).toBeCloseTo(3.5);
  });

  it('Drivia 18 : entraxe officiel de 125 mm ; Resi9 : vue schématique non mesurée', () => {
    const g = boardGeometry(getEnclosure('legrand-drivia18-4r')!);
    expect(g.rowPitch).toBe(125);
    expect(g.windowWidth).toBe(324);
    const s = boardGeometry(getEnclosure('schneider-resi9-13-2r')!);
    expect(s.measured).toBe(false);
  });
});

describe('Nomenclature et icônes', () => {
  it('regroupe les appareils identiques', () => {
    const bom = buildBom([dev('a', 0, 0), dev('b', 0, 1), dev('c', 0, 2, 2, { productId: 'legrand-rcd-40-A' })]);
    expect(bom.map((l) => [l.product.id, l.quantity])).toEqual([
      ['legrand-rcd-40-A', 1],
      ['legrand-breaker-C-16', 2],
    ]);
  });

  it('suggestion d’icône à partir du texte', () => {
    expect(suggestIcon('Four')).toBe('four');
    expect(suggestIcon('Lave-linge')).toBe('lave-linge');
    expect(suggestIcon('VMC')).toBe('vmc');
    expect(suggestIcon('Plaque')).toBe('plaque');
    expect(suggestIcon('Prises cuisine')).toBe('prises-cuisine');
    expect(suggestIcon('Lumières salon')).toBe('eclairage');
    expect(suggestIcon('Chauffe-eau')).toBe('chauffe-eau');
    expect(suggestIcons('')).toEqual([]);
    expect(LABEL_ICONS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(LABEL_ICONS.map((i) => i.id)).size).toBe(LABEL_ICONS.length);
    expect(iconMarkup('four', 'u1')).toContain('url(#u1-steel)');
  });
});

describe('Éditeur de tableau (store)', () => {
  beforeEach(() => {
    usePanelEditor.getState().load(createPanelProject('Maison Dupont', 'legrand'));
    usePanelEditor.getState().setEnclosure('legrand-drivia13-4r');
  });

  it('pose, collision, rangée complète, annuler / rétablir', () => {
    const st = usePanelEditor.getState();
    expect(st.addDevice('legrand-rcd-40-A', 0, 0).ok).toBe(true);
    expect(usePanelEditor.getState().addDevice('legrand-breaker-C-10', 0, 1).message).toBe('Emplacement déjà occupé');
    for (let i = 2; i < 13; i++) expect(usePanelEditor.getState().addDevice('legrand-breaker-C-16', 0, i).ok).toBe(true);
    expect(usePanelEditor.getState().addDevice('legrand-breaker-C-16', 0, 5).message).toBe('Rangée complète');
    expect(usePanelEditor.getState().doc!.devices).toHaveLength(12);
    usePanelEditor.getState().undo();
    expect(usePanelEditor.getState().doc!.devices).toHaveLength(11);
    usePanelEditor.getState().redo();
    expect(usePanelEditor.getState().doc!.devices).toHaveLength(12);
    // Un différentiel n'a ni repère ni désignation imposés
    const rcd = usePanelEditor.getState().doc!.devices.find((d) => d.productId === 'legrand-rcd-40-A')!;
    expect(rcd).toMatchObject({ label: '', circuitRef: '', shortLabel: '' });
  });

  it('déplacement entre rangées, duplication, étiquette, changement de marque', () => {
    const id = usePanelEditor.getState().addDevice('legrand-breaker-C-20', 0, 3).id!;
    expect(usePanelEditor.getState().moveDevice(id, 1, 4).ok).toBe(true);
    expect(usePanelEditor.getState().doc!.devices[0]).toMatchObject({ row: 1, startModule: 4 });
    const copy = usePanelEditor.getState().duplicateDevice(id).id!;
    expect(usePanelEditor.getState().doc!.devices.find((d) => d.id === copy)).toMatchObject({ row: 1, startModule: 5 });
    usePanelEditor.getState().updateLabel(id, { label: 'F' }, 'label-x');
    usePanelEditor.getState().updateLabel(id, { label: 'Fo' }, 'label-x');
    usePanelEditor.getState().updateLabel(id, { label: 'Four', icon: 'four' }, 'label-x');
    const pastLen = usePanelEditor.getState().past.length;
    usePanelEditor.getState().undo();
    // Saisie regroupée : une seule étape annulée
    expect(usePanelEditor.getState().doc!.devices.find((d) => d.id === id)!.label).toBe('');
    usePanelEditor.getState().redo();
    expect(usePanelEditor.getState().past.length).toBe(pastLen);
    const removed = usePanelEditor.getState().setBrand('hager', 'hager-gamma13-4r');
    expect(removed).toEqual([]);
    const devices = usePanelEditor.getState().doc!.devices;
    expect(devices.every((d) => d.productId.startsWith('hager-'))).toBe(true);
    expect(devices.find((d) => d.id === id)!.label).toBe('Four');
  });

  it('réduire le nombre de rangées retire les appareils hors tableau', () => {
    usePanelEditor.getState().addDevice('legrand-breaker-C-16', 3, 0);
    usePanelEditor.getState().addDevice('legrand-breaker-C-16', 0, 0);
    const removed = usePanelEditor.getState().setEnclosure('legrand-drivia13-2r');
    expect(removed).toHaveLength(1);
    expect(usePanelEditor.getState().doc!.devices).toHaveLength(1);
  });

  it('fusionner puis séparer des zones d’étiquette ; dupliquer une rangée', () => {
    const a = usePanelEditor.getState().addDevice('legrand-contactor-hc-20', 0, 0).id!;
    usePanelEditor.getState().addDevice('legrand-breaker-C-20', 0, 1);
    expect(usePanelEditor.getState().mergeWithNext(a).ok).toBe(true);
    const p = usePanelEditor.getState().doc!;
    expect(labelZones(p.devices, 0, 'both')).toHaveLength(1);
    usePanelEditor.getState().splitZone(a);
    expect(labelZones(usePanelEditor.getState().doc!.devices, 0, 'both')).toHaveLength(2);
    expect(usePanelEditor.getState().duplicateRow(0).ok).toBe(true);
    expect(usePanelEditor.getState().doc!.devices.filter((d) => d.row === 1)).toHaveLength(2);
  });
});
