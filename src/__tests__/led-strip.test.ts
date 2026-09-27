import { beforeEach, describe, expect, it } from 'vitest';
import type { LedStrip, Wall } from '../types';
import {
  insertLedPoint,
  ledCaption,
  ledCaptionPlacement,
  ledLegendLabel,
  ledLength,
  ledLengthMeters,
  moveLedPoint,
  removeLedPoint,
  snapLedPoint,
  snapToWallFace,
  translateLed,
} from '../utils/ledStrip';
import { emptyDocument, useEditorStore } from '../store/editorStore';
import { useLedDraftStore } from '../store/ledDraftStore';
import { commitLedDraft, finishLedTool, startLedTool, undoLedPoint } from '../components/editor/ledActions';
import { createPlan } from '../utils/planFactory';

// Chambre 500 × 340, murs de 10 d'épaisseur (centres sur x = 100 / 600, y = 560 / 900)
const walls: Wall[] = [
  { id: 'top', x1: 100, y1: 560, x2: 600, y2: 560, thickness: 10 },
  { id: 'right', x1: 600, y1: 560, x2: 600, y2: 900, thickness: 10 },
  { id: 'bottom', x1: 600, y1: 900, x2: 100, y2: 900, thickness: 10 },
  { id: 'left', x1: 100, y1: 900, x2: 100, y2: 560, thickness: 10 },
];

const strip = (points: number[], closed = false): LedStrip => ({ id: 'l1', points, closed, color: '#eab308', width: 6 });

describe('Bande LED : géométrie', () => {
  it('longueur ouverte / fermée et en mètres', () => {
    const rect = [0, 0, 300, 0, 300, 200, 0, 200];
    expect(ledLength(rect)).toBe(800);
    expect(ledLength(rect, true)).toBe(1000);
    expect(ledLengthMeters(strip(rect, true), 100)).toBeCloseTo(10);
    expect(ledLengthMeters(strip(rect), undefined)).toBeNull();
    expect(ledCaption(strip(rect, true), 100)).toBe('LED 10,00 m');
    expect(ledCaption({ ...strip(rect), label: 'LED 24 V' })).toBe('LED 24 V');
  });

  it('ajouter, déplacer, retirer un angle ; déplacer toute la bande', () => {
    const pts = [0, 0, 100, 0];
    const withCorner = insertLedPoint(pts, 0, { x: 50, y: 40 });
    expect(withCorner).toEqual([0, 0, 50, 40, 100, 0]);
    expect(moveLedPoint(withCorner, 2, { x: 120, y: 10 })).toEqual([0, 0, 50, 40, 120, 10]);
    expect(removeLedPoint(withCorner, 1)).toEqual([0, 0, 100, 0]);
    // Jamais moins de 2 points (3 pour un contour fermé)
    expect(removeLedPoint(pts, 0)).toBeNull();
    expect(removeLedPoint([0, 0, 10, 0, 10, 10], 0, true)).toBeNull();
    expect(translateLed(pts, 5, -5)).toEqual([5, -5, 105, -5]);
  });

  it('libellé d’un contour fermé placé vers l’intérieur', () => {
    const place = ledCaptionPlacement([0, 0, 400, 0, 400, 100, 0, 100], true)!;
    // Plus long segment = haut (y = 0) ; l'intérieur est vers y > 0
    expect(place.y).toBe(0);
    expect(place.ny).toBeGreaterThan(0);
    expect(Math.abs(place.angle)).toBeLessThanOrEqual(90);
  });

  it('accroche le long de la face intérieure du mur, et dans l’angle de la pièce', () => {
    const onTop = snapToWallFace({ x: 300, y: 575 }, walls, 20, 4)!;
    expect(onTop).toEqual({ x: 300, y: 569 }); // 560 + 10/2 + 4
    const corner = snapToWallFace({ x: 118, y: 574 }, walls, 20, 4)!;
    expect(corner.x).toBeCloseTo(109);
    expect(corner.y).toBeCloseTo(569);
    expect(snapToWallFace({ x: 350, y: 730 }, walls, 20, 4)).toBeNull();
  });

  it('priorité : point de départ (fermeture) > mur > angle droit', () => {
    const base = { walls, radius: 20, gap: 4, snapWalls: true };
    expect(snapLedPoint({ x: 112, y: 571 }, { ...base, from: { x: 109, y: 800 }, start: { x: 109, y: 569 } }).kind).toBe('start');
    expect(snapLedPoint({ x: 300, y: 580 }, { ...base, from: { x: 109, y: 569 } }).point).toEqual({ x: 300, y: 569 });
    // Loin des murs : accroche à l'horizontale depuis le point précédent
    const free = snapLedPoint({ x: 400, y: 733 }, { ...base, from: { x: 250, y: 730 } });
    expect(free.kind).toBe('free');
    expect(free.point.y).toBeCloseTo(730);
  });

  it('légende : nombre et longueur totale', () => {
    expect(ledLegendLabel([])).toBeNull();
    expect(ledLegendLabel([strip([0, 0, 150, 0]), strip([0, 0, 0, 90])], 100)).toBe('Bande LED — 2,40 m');
  });
});

describe('Bande LED : éditeur', () => {
  beforeEach(() => {
    const plan = createPlan('p', 'RDC', 'rdc', 0);
    useEditorStore.getState().load(plan, emptyDocument());
    useLedDraftStore.getState().reset();
  });

  it('tracé point par point, annuler un point, terminer = bande sélectionnée', () => {
    startLedTool();
    expect(useEditorStore.getState().tool).toBe('led');
    const d = useLedDraftStore.getState();
    d.setPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ]);
    undoLedPoint();
    expect(useLedDraftStore.getState().points).toHaveLength(2);
    finishLedTool();
    const st = useEditorStore.getState();
    expect(st.tool).toBe('select');
    expect(st.doc.ledStrips).toHaveLength(1);
    expect(st.doc.ledStrips[0].points).toEqual([0, 0, 100, 0]);
    expect(st.selection).toEqual({ kind: 'led', ids: [st.doc.ledStrips[0].id] });
    // Une seule entrée d'historique
    st.undo();
    expect(useEditorStore.getState().doc.ledStrips).toHaveLength(0);
  });

  it('fermer le contour et prolonger une bande existante', () => {
    useLedDraftStore.getState().start([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
    const id = commitLedDraft({ close: true })!;
    expect(useEditorStore.getState().doc.ledStrips[0].closed).toBe(true);
    // Bande ouverte, puis prolongée
    useLedDraftStore.getState().start([
      { x: 0, y: 300 },
      { x: 50, y: 300 },
    ]);
    const open = commitLedDraft()!;
    expect(open).not.toBe(id);
    startLedTool(open);
    const draft = useLedDraftStore.getState();
    expect(draft.extendId).toBe(open);
    draft.setPoints([...draft.points, { x: 50, y: 350 }]);
    finishLedTool();
    const extended = useEditorStore.getState().doc.ledStrips.find((l) => l.id === open)!;
    expect(extended.points).toEqual([0, 300, 50, 300, 50, 350]);
    expect(useEditorStore.getState().doc.ledStrips).toHaveLength(2);
  });

  it('tracé trop court : rien n’est créé', () => {
    useLedDraftStore.getState().start([{ x: 0, y: 0 }]);
    expect(commitLedDraft()).toBeNull();
    expect(useEditorStore.getState().doc.ledStrips).toHaveLength(0);
  });

  it('dupliquer, copier / coller, supprimer', () => {
    useLedDraftStore.getState().start([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const id = commitLedDraft()!;
    const st = useEditorStore.getState();
    st.select('led', [id]);
    st.duplicateSelection(20);
    expect(useEditorStore.getState().doc.ledStrips[1].points).toEqual([20, 20, 120, 20]);
    useEditorStore.getState().copySelection();
    useEditorStore.getState().paste();
    expect(useEditorStore.getState().doc.ledStrips).toHaveLength(3);
    useEditorStore.getState().deleteSelection();
    expect(useEditorStore.getState().doc.ledStrips).toHaveLength(2);
  });

  it('un geste annulé (pincement) ne déplace rien', () => {
    useLedDraftStore.getState().start([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const id = commitLedDraft()!;
    const st = useEditorStore.getState();
    st.beginGesture();
    st.updateTransient((d) => ({ ...d, ledStrips: d.ledStrips.map((l) => (l.id === id ? { ...l, points: translateLed(l.points, 50, 50) } : l)) }));
    useEditorStore.getState().cancelGesture();
    // Hors geste, une mise à jour transitoire est ignorée
    useEditorStore.getState().updateTransient((d) => ({ ...d, ledStrips: [] }));
    expect(useEditorStore.getState().doc.ledStrips[0].points).toEqual([0, 0, 100, 0]);
  });
});

describe('Bande LED : export PDF', () => {
  it('le PDF vectoriel inclut les bandes LED (tracé + légende) sans erreur', async () => {
    const { buildDemoBundle } = await import('../data/demoProject');
    const { DEFAULT_PDF_OPTIONS, generatePlanPdf } = await import('../services/pdf/planPdfExport');
    const bundle = buildDemoBundle();
    const plan = bundle.plans[0];
    const doc = {
      ...plan.vectorData,
      ledStrips: [strip([112, 569, 591, 569, 591, 888, 112, 888], true), { ...strip([200, 700, 450, 700]), id: 'l2', label: 'LED 24 V' }],
      scale: plan.scale,
      symbols: bundle.symbols,
      connections: bundle.connections,
    };
    const base = { ...DEFAULT_PDF_OPTIONS, includeLogo: false, showOriginal: false };
    const withLed = await generatePlanPdf(bundle.project, [{ plan, doc }], base);
    const portrait = await generatePlanPdf(bundle.project, [{ plan, doc: { ...doc, symbols: [] } }], { ...base, orientation: 'portrait' });
    expect(withLed.length).toBeGreaterThan(2000);
    expect(portrait.length).toBeGreaterThan(2000);
  });
});
