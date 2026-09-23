import { beforeEach, describe, expect, it } from 'vitest';
import type { ElectricalConnection, PlacedSymbol, Plan } from '../types';
import { connectionGeometry, nextCommandGroup } from '../utils/connections';
import { bezierPoint } from '../utils/geometry';
import { HISTORY_LIMIT, emptyDocument, useEditorStore } from '../store/editorStore';
import { createPlan } from '../utils/planFactory';

const sym = (id: string, x: number, y: number, symbolType = 'va-et-vient'): PlacedSymbol => ({
  id,
  projectId: 'p',
  planId: 'pl',
  symbolType,
  x,
  y,
  rotation: 0,
  scale: 1,
  properties: {},
});
const conn = (id: string, sourceId: string, targetId: string, group?: number): ElectricalConnection => ({
  id,
  projectId: 'p',
  planId: 'pl',
  sourceId,
  targetId,
  type: 'command',
  color: '#f97316',
  width: 2,
  dash: 'dash',
  curvature: 0.25,
  group,
});

describe('Liaison des symboles', () => {
  it('va-et-vient 1 + va-et-vient 2 → même plafonnier = même groupe de commande', () => {
    const first = [conn('a', 'vv1', 'lamp', 1)];
    expect(nextCommandGroup(first, 'vv2', 'lamp')).toBe(1);
    expect(nextCommandGroup(first, 'inter', 'spot')).toBe(2);
  });

  it('la liaison suit le symbole déplacé (ancrages recalculés)', () => {
    const c = conn('c', 's', 't');
    const s = sym('s', 0, 0);
    const t = sym('t', 200, 0, 'point-lumineux');
    const before = connectionGeometry(c, s, t);
    const after = connectionGeometry(c, { ...s, x: 50, y: 80 }, t);
    expect(before.p0.x).toBeGreaterThan(0);
    expect(after.p0.y).toBeGreaterThan(before.p0.y);
    // la courbe relie bien les deux symboles
    const mid = bezierPoint(after, 0.5);
    expect(mid.x).toBeGreaterThan(50);
    expect(mid.x).toBeLessThan(200);
    expect(after.p1.x).toBeLessThan(200);
  });
});

describe('Éditeur : historique annuler / rétablir', () => {
  let plan: Plan;
  beforeEach(() => {
    plan = createPlan('p', 'RDC', 'rdc', 0);
    useEditorStore.getState().load(plan, emptyDocument());
  });

  it('ajout, annulation, rétablissement', () => {
    const st = useEditorStore.getState();
    st.addSymbol(sym('s1', 10, 10));
    st.addSymbol(sym('s2', 20, 20));
    expect(useEditorStore.getState().doc.symbols).toHaveLength(2);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.symbols).toHaveLength(1);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().doc.symbols).toHaveLength(2);
  });

  it('conserve au moins 100 actions', () => {
    for (let i = 0; i < 130; i++) useEditorStore.getState().addSymbol(sym(`s${i}`, i, i));
    expect(useEditorStore.getState().past.length).toBe(130);
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(100);
    for (let i = 0; i < 100; i++) useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.symbols).toHaveLength(30);
  });

  it('un glisser = une seule entrée d’historique', () => {
    useEditorStore.getState().addSymbol(sym('s1', 0, 0));
    const pastBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().beginGesture();
    for (let i = 1; i <= 20; i++) useEditorStore.getState().updateTransient((d) => ({ ...d, symbols: d.symbols.map((s) => ({ ...s, x: i })) }));
    useEditorStore.getState().endGesture();
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.symbols[0].x).toBe(0);
  });

  it('supprimer un symbole supprime ses liaisons ; dupliquer décale de 20', () => {
    const st = useEditorStore.getState();
    st.addSymbol(sym('a', 0, 0));
    st.addSymbol(sym('b', 100, 0, 'point-lumineux'));
    expect(useEditorStore.getState().addConnection('a', 'b', { color: '#f97316', width: 2 })).toBe('created');
    expect(useEditorStore.getState().addConnection('b', 'a', { color: '#f97316', width: 2 })).toBe('duplicate');
    useEditorStore.getState().select('symbol', ['a']);
    useEditorStore.getState().duplicateSelection(20);
    const copy = useEditorStore.getState().doc.symbols.find((s) => s.id !== 'a' && s.id !== 'b')!;
    expect(copy.x).toBe(20);
    useEditorStore.getState().select('symbol', ['a']);
    useEditorStore.getState().deleteSelection();
    expect(useEditorStore.getState().doc.connections).toHaveLength(0);
  });

  it('copier / coller', () => {
    useEditorStore.getState().addSymbol(sym('a', 5, 5));
    useEditorStore.getState().select('symbol', ['a']);
    useEditorStore.getState().copySelection();
    useEditorStore.getState().paste();
    const syms = useEditorStore.getState().doc.symbols;
    expect(syms).toHaveLength(2);
    expect(syms[1].x).toBe(29);
  });
});
