import { describe, expect, it } from 'vitest';
import type { PlacedSymbol, Wall } from '../types';
import { projectPointOnSegment, rotatePoint, snapSegmentEnd, snapToWalls } from '../utils/geometry';
import { snapSymbol, symbolWallDepth } from '../utils/symbols';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { circlePath, parseSvgPath, transformSvgPath } from '../utils/svgPath';
import { clampOpeningT, doorGeometry } from '../utils/openings';

const wallH: Wall = { id: 'h', x1: 0, y1: 100, x2: 400, y2: 100, thickness: 10 };
const wallV: Wall = { id: 'v', x1: 300, y1: 0, x2: 300, y2: 400, thickness: 10 };

describe('Aimantation aux murs (snap mur)', () => {
  it('projette le point sur le mur horizontal, côté du point, et oriente le symbole', () => {
    const r = snapToWalls({ x: 120, y: 110 }, [wallH], 15, 8);
    expect(r).not.toBeNull();
    expect(r!.wallId).toBe('h');
    expect(r!.x).toBeCloseTo(120);
    expect(r!.y).toBeCloseTo(100 + 5 + 8); // face du mur + profondeur
    expect(r!.rotation).toBeCloseTo(0);
  });

  it('retourne le symbole de l’autre côté du mur', () => {
    const r = snapToWalls({ x: 120, y: 92 }, [wallH], 15, 8);
    expect(r!.y).toBeCloseTo(100 - 5 - 8);
    expect(Math.abs(r!.rotation)).toBeCloseTo(180);
  });

  it('s’oriente selon un mur vertical', () => {
    const r = snapToWalls({ x: 310, y: 200 }, [wallV], 15, 0);
    expect(r!.x).toBeCloseTo(305);
    // le haut local du symbole (0,-1) pointe vers le mur (vers la gauche)
    const up = rotatePoint({ x: 0, y: -1 }, r!.rotation);
    expect(up.x).toBeCloseTo(-1);
    expect(up.y).toBeCloseTo(0);
  });

  it('ne s’aimante pas au-delà de la distance d’aimantation', () => {
    expect(snapToWalls({ x: 120, y: 160 }, [wallH], 15, 8)).toBeNull();
  });

  it('prise : profondeur calculée depuis la bibliothèque ; point lumineux : pas d’aimantation', () => {
    const socket = getSymbolDefinition('prise-16a');
    const light = getSymbolDefinition('point-lumineux');
    expect(symbolWallDepth(socket, 1)).toBeCloseTo(0.4 * socket.defaultSize);
    expect(snapSymbol(socket, 1, { x: 50, y: 120 }, [wallH], 15)).not.toBeNull();
    expect(snapSymbol(light, 1, { x: 50, y: 120 }, [wallH], 15)).toBeNull();
  });

  it('projection bornée aux extrémités', () => {
    const p = projectPointOnSegment({ x: -50, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(p.t).toBe(0);
    expect(p.distance).toBe(50);
  });

  it('redresse un tracé presque horizontal', () => {
    const q = snapSegmentEnd({ x: 0, y: 0 }, { x: 100, y: 4 });
    expect(q.y).toBeCloseTo(0);
    expect(q.x).toBeCloseTo(Math.hypot(100, 4));
  });
});

describe('Ouvertures', () => {
  it('borne la porte dans le mur et calcule le battant', () => {
    expect(clampOpeningT(wallH, 0, 80)).toBeCloseTo(0.1);
    const g = doorGeometry(wallH, 0.5, 80, false, false);
    expect(g.hinge).toEqual({ x: 160, y: 100 });
    expect(g.leafEnd.x).toBeCloseTo(160);
    expect(g.leafEnd.y).toBeCloseTo(180);
  });
});

describe('Chemins SVG (symboles vectoriels PDF)', () => {
  it('analyse les commandes relatives et absolues', () => {
    const cmds = parseSvgPath('M0 0h10v10l-10 0z');
    expect(cmds.map((c) => c.c)).toEqual(['M', 'L', 'L', 'L', 'Z']);
  });

  it('applique rotation + échelle + translation (y compris arcs)', () => {
    const d = transformSvgPath('M10 0L20 0', { tx: 100, ty: 50, rotation: 90, scale: 2 });
    expect(d).toBe('M100 70 L100 90');
    expect(transformSvgPath('M-5 0A5 5 0 0 0 5 0', { tx: 0, ty: 0, rotation: 0, scale: 3 })).toBe('M-15 0 A15 15 0 0 0 15 0');
    expect(circlePath(0, 0, 2)).toContain('A2 2 0 1 0 2 0');
  });

  it('toutes les primitives de la bibliothèque sont analysables', () => {
    const sym: PlacedSymbol['symbolType'][] = ['prise-16a', 'va-et-vient', 'plaque-induction', 'tableau-electrique'];
    for (const id of sym) for (const s of getSymbolDefinition(id).shapes) if (s.k === 'path') expect(() => parseSvgPath(s.d)).not.toThrow();
  });
});
