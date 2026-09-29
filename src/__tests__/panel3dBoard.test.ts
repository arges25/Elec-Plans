import { beforeEach, describe, expect, it } from 'vitest';
import type { PlacedDevice } from '../features/panel3d/types';
import { MANUFACTURERS, getProduct } from '../features/panel3d/data/catalog';
import { referenceDevices } from '../features/panel3d/data/referenceBoard';
import { suggestShortLabel } from '../features/panel3d/data/circuits';
import { compactRow, conflictOptions, insertWithShift, numberCircuits, occupancy, rowTotal } from '../features/panel3d/engine/boardOps';
import { schemaGeometry, schemaHitTest } from '../features/panel3d/engine/schemaGeometry';
import { usePanelEditor, displayLabel } from '../features/panel3d/store/panelEditorStore';
import { createPanelProject, normalizeProject, toDoc } from '../features/panel3d/store/projectFactory';
import { fitLabelText } from '../utils/labelLayout';

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
const cap = { rows: 3, modulesPerRow: 13 };

describe('Tableau de référence (3 rangées de 13 modules)', () => {
  const devices = referenceDevices('legrand');

  it('occupation : 39 modules, 31 utilisés, 8 libres = 20,5 %', () => {
    const o = occupancy(devices, cap);
    expect(o).toMatchObject({ totalModules: 39, usedModules: 31, freeModules: 8, reservedModules: 6 });
    expect(o.freePercent).toBeCloseTo(20.51, 1);
  });

  it('totaux de rangée : seulement avec une règle choisie (somme × 0,5 = 50 / 48 / 51 A)', () => {
    expect(rowTotal(devices, 0, { kind: 'none' }).value).toBeNull();
    expect(rowTotal(devices, 0, { kind: 'sum' }).value).toBe(100);
    const coef = { kind: 'sum-coef', coef: 0.5 } as const;
    expect([0, 1, 2].map((r) => rowTotal(devices, r, coef).value)).toEqual([50, 48, 51]);
    expect(rowTotal(devices, 0, { kind: 'none' })).toMatchObject({ breakerCount: 6, rcdRatings: [63] });
  });

  it('repères libres non séquentiels et prises modulaires sur plusieurs modules', () => {
    expect(devices.filter((d) => d.row === 0).map((d) => d.circuitRef)).toEqual(['', '1', '14', '5', '14', '5', '9', '10', 'disj. tab. div.']);
    const sockets = devices.filter((d) => getProduct(d.productId)?.kind === 'socket');
    expect(sockets.map((d) => [d.startModule, d.moduleWidth])).toEqual([
      [8, 2.5],
      [10.5, 2.5],
    ]);
  });
});

describe('Références fabricants vérifiées', () => {
  it('disjoncteurs réels : Legrand DNX³ 406775, Schneider R9PFC620, Hager MFN720 (C20)', () => {
    expect(getProduct('legrand-breaker-C-20')).toMatchObject({ reference: '406775', family: 'DNX³ 4500', verified: true });
    expect(getProduct('schneider-breaker-C-20')).toMatchObject({ reference: 'R9PFC620', family: 'Resi9 XP' });
    expect(getProduct('hager-breaker-C-20')).toMatchObject({ reference: 'MFN720' });
    expect(getProduct('legrand-rcd-63-AC')!.reference).toBe('411506');
  });

  it('toute référence vérifiée a une source officielle ; sinon pas de référence', () => {
    const official = ['legrand.fr', 'se.com', 'hager.com'];
    for (const m of Object.values(MANUFACTURERS)) {
      for (const d of m.devices) {
        if (d.verified) {
          expect(d.reference).toBeTruthy();
          expect(official.some((o) => d.sourceUrl!.includes(o))).toBe(true);
          expect(d.lastVerified).toBeTruthy();
        } else expect(d.reference).toBeNull();
      }
    }
    // Pas de référence inventée : Resi9 63 A type AC (fin de commercialisation) non renseigné
    expect(getProduct('schneider-rcd-63-AC')!.reference).toBeNull();
  });
});

describe('Réorganisation d’une rangée', () => {
  it('insertion avec décalage des appareils suivants, refus si la rangée déborde', () => {
    const d = [dev('a', 0, 0, 2), dev('b', 0, 2), dev('c', 0, 3), dev('z', 0, 6)];
    const r = insertWithShift(d, cap, 0, 2, 1)!;
    expect(r.start).toBe(2);
    expect(r.devices.find((x) => x.id === 'b')!.startModule).toBe(3);
    expect(r.devices.find((x) => x.id === 'c')!.startModule).toBe(4);
    // L'espace libre absorbe le décalage : « z » ne bouge pas
    expect(r.devices.find((x) => x.id === 'z')!.startModule).toBe(6);
    // Insertion au milieu d'un différentiel : juste avant lui
    expect(insertWithShift(d, cap, 0, 1, 1)!.start).toBe(0);
    const full = Array.from({ length: 13 }, (_, i) => dev(`f${i}`, 1, i));
    expect(insertWithShift(full, cap, 1, 4, 1)).toBeNull();
    expect(conflictOptions(full, cap, 1, 4, 1)).toMatchObject({ canShift: false, canReplace: true });
  });

  it('compacter la rangée ; la suppression laisse l’emplacement libre', () => {
    const d = compactRow([dev('a', 0, 2), dev('b', 0, 5, 2), dev('c', 1, 7)], 0);
    expect(d.filter((x) => x.row === 0).map((x) => x.startModule)).toEqual([0, 1]);
    expect(d.find((x) => x.id === 'c')!.startModule).toBe(7);
  });

  it('numérotation automatique des disjoncteurs (rangée par rangée)', () => {
    const d = numberCircuits([dev('r', 0, 0, 2, { productId: 'legrand-rcd-63-A' }), dev('b', 0, 3), dev('a', 0, 2), dev('c', 1, 0)]);
    expect(Object.fromEntries(d.map((x) => [x.id, x.circuitRef]))).toEqual({ r: '', a: '1', b: '2', c: '3' });
  });
});

describe('Étiquettes : abréviations et texte long', () => {
  it('nom court proposé (jamais imposé)', () => {
    expect(suggestShortLabel('Prises cuisine')).toBe('PC CUISINE');
    expect(suggestShortLabel('Éclairage chambre 2')).toBe('ECL CH 2');
    expect(suggestShortLabel('Lave-vaisselle')).toBe('LV');
    expect(suggestShortLabel('Volet roulant séjour')).toBe('VR SÉJOUR');
    expect(suggestShortLabel('Plaque induction')).toBe('PLAQUE');
  });

  it('texte long : réduction légère et retour à la ligne (3 lignes), pas de texte minuscule', () => {
    const f = fitLabelText('Plaque induction', 16.4, 20, 10.5, 3, undefined, true, 0.8);
    expect(f.truncated).toBe(false);
    expect(f.lines.length).toBeGreaterThanOrEqual(2);
    expect(f.fontSizePt).toBeGreaterThanOrEqual(10.5 * 0.8);
  });

  it('affichage nom long / nom court', () => {
    expect(displayLabel({ labelText: 'long' }, { label: 'Prises cuisine', shortLabel: 'PC CUISINE' })).toBe('Prises cuisine');
    expect(displayLabel({ labelText: 'short' }, { label: 'Prises cuisine', shortLabel: 'PC CUISINE' })).toBe('PC CUISINE');
    expect(displayLabel({ labelText: 'short' }, { label: 'Four', shortLabel: '' })).toBe('Four');
  });
});

describe('Vue schéma : zones repère / appareil / étiquette', () => {
  it('le toucher distingue le repère (au-dessus), l’appareil et l’étiquette (dessous)', () => {
    const g = schemaGeometry({ rows: 3, modulesPerRow: 13 });
    const r = g.rows[1];
    const x = g.gridX + 3.5 * g.moduleW;
    expect(schemaHitTest(g, x, r.refY + 4)).toMatchObject({ row: 1, zone: 'ref' });
    expect(schemaHitTest(g, x, r.devY + 40)).toMatchObject({ row: 1, zone: 'device' });
    expect(schemaHitTest(g, x, r.labelY + 5)).toMatchObject({ row: 1, zone: 'label' });
    expect(Math.floor(schemaHitTest(g, x, r.devY + 40)!.module)).toBe(3);
  });
});

describe('Projet : plusieurs tableaux, migration', () => {
  beforeEach(() => usePanelEditor.getState().load(createPanelProject('Maison Dupont', 'legrand')));

  it('ajouter, basculer, dupliquer et supprimer des tableaux', () => {
    const ed = usePanelEditor.getState;
    expect(ed().doc!.title).toBe('TABLEAU PRINCIPAL');
    ed().addDevice('legrand-breaker-C-20', 0, 0);
    const garage = ed().addBoard('TABLEAU GARAGE');
    expect(ed().doc!).toMatchObject({ id: garage, title: 'TABLEAU GARAGE' });
    expect(ed().doc!.devices).toHaveLength(0);
    ed().setActiveBoard(ed().project!.boards[0].id);
    expect(ed().doc!.devices).toHaveLength(1);
    ed().duplicateBoard(ed().project!.boards[0].id);
    expect(ed().project!.boards).toHaveLength(3);
    expect(ed().removeBoard(garage).ok).toBe(true);
    expect(ed().project!.boards.map((b) => b.title)).toEqual(['TABLEAU PRINCIPAL', 'TABLEAU PRINCIPAL (COPIE)']);
  });

  it('pose d’un disjoncteur : « Quel circuit ? » proposé, préréglage applicable', () => {
    const ed = usePanelEditor.getState;
    const id = ed().addDevice('legrand-breaker-C-20', 0, 0).id!;
    expect(ed().circuitPromptFor).toBe(id);
    ed().applyPreset(id, 'four');
    expect(ed().doc!.devices[0]).toMatchObject({ label: 'Four', shortLabel: 'FOUR', icon: 'four' });
    ed().setSettings({ askCircuitOnDrop: false });
    ed().addDevice('legrand-breaker-C-10', 0, 1);
    expect(ed().circuitPromptFor).toBeNull();
  });

  it('pose sur un emplacement occupé : décaler ou remplacer ; réserver un emplacement', () => {
    const ed = usePanelEditor.getState;
    ed().setSettings({ askCircuitOnDrop: false });
    const a = ed().addDevice('legrand-breaker-C-20', 0, 2).id!;
    expect(ed().addDevice('legrand-breaker-C-16', 0, 2).ok).toBe(false);
    expect(ed().addDevice('legrand-breaker-C-16', 0, 2, 'shift').ok).toBe(true);
    expect(ed().doc!.devices.find((d) => d.id === a)!.startModule).toBe(3);
    expect(ed().addDevice('legrand-breaker-C-32', 0, 3, 'replace').ok).toBe(true);
    expect(ed().doc!.devices.some((d) => d.id === a)).toBe(false);
    expect(ed().reserveSlot(1, 0, 3).ok).toBe(true);
    const res = ed().doc!.devices.find((d) => d.row === 1)!;
    expect(res).toMatchObject({ moduleWidth: 3, label: 'RÉSERVE' });
    expect(occupancy(ed().doc!.devices, { rows: 2, modulesPerRow: 13 }).reservedModules).toBe(3);
  });

  it('migration d’un projet de la version précédente (un seul tableau)', () => {
    const v1 = {
      id: 'p1',
      name: 'Ancien',
      projectId: null,
      brand: 'hager',
      enclosureId: 'hager-gamma13-2r',
      devices: [{ id: 'd1', manufacturer: 'hager', productId: 'hager-breaker-C-16', row: 0, startModule: 0, moduleWidth: 1, label: 'Four', icon: 'four', labelStyle: null, mergedWithPrev: false, linkedComponents: [] }],
      labelStyle: 'both',
      showModuleNumbers: false,
      showAllBrands: false,
      print: { moduleMm: 18, labelHeightMm: 12, fontSizePt: 8 },
      createdAt: 1,
      updatedAt: 2,
      version: 1,
    };
    const p = normalizeProject(v1);
    expect(p.version).toBe(2);
    expect(p.boards).toHaveLength(1);
    expect(p.boards[0]).toMatchObject({ title: 'TABLEAU PRINCIPAL', brand: 'hager', enclosureId: 'hager-gamma13-2r' });
    expect(p.boards[0].devices[0]).toMatchObject({ label: 'Four', circuitRef: '', shortLabel: '', notes: '' });
    expect(p.print.showRef).toBe(true);
    expect(toDoc(p).labelStyle).toBe('both');
  });
});
