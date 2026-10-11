import { describe, expect, it } from 'vitest';
import type { ElectricalConnection, PlacedSymbol } from '../types';
import { findPanelSymbol, findSupplyPath, indicativeChain, supplyInfo } from '../utils/supplyPath';
import { circuitLabel, parseAmps, parseSection } from '../utils/electrical';

const sym = (id: string, symbolType: string, x: number, y: number): PlacedSymbol => ({
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

const link = (id: string, sourceId: string, targetId: string, type: ElectricalConnection['type'] = 'circuit'): ElectricalConnection => ({
  id,
  projectId: 'p',
  planId: 'pl',
  sourceId,
  targetId,
  type,
  color: '#000',
  width: 2,
  dash: 'long',
  curvature: 0,
});

describe('Flash « Alimentation » : chemin jusqu’au tableau', () => {
  const panel = sym('tab', 'tableau-electrique', 0, 0);
  const p1 = sym('p1', 'prise-16a', 100, 0);
  const p2 = sym('p2', 'prise-16a', 200, 0);
  const p3 = sym('p3', 'prise-16a', 300, 0);
  const inter = sym('i1', 'inter-simple', 0, 200);
  const lum = sym('l1', 'point-lumineux', 100, 200);
  const symbols = [panel, p1, p2, p3, inter, lum];

  it('distingue câble de prises et câble d’éclairage / commande', () => {
    expect(supplyInfo('prise-16a')?.kind).toBe('prise');
    expect(supplyInfo('four')?.kind).toBe('prise');
    expect(supplyInfo('inter-simple')?.kind).toBe('eclairage');
    expect(supplyInfo('point-lumineux')?.kind).toBe('eclairage');
    expect(supplyInfo('prise-16a')?.color).not.toBe(supplyInfo('inter-simple')?.color);
    expect(supplyInfo('prise-rj45')).toBeNull();
    expect(supplyInfo('tableau-electrique')).toBeNull();
  });

  it('suit les liaisons « Relier » de proche en proche jusqu’au tableau', () => {
    const conns = [link('c1', 'tab', 'p1'), link('c2', 'p1', 'p2'), link('c3', 'p3', 'p2')];
    const path = findSupplyPath('p3', symbols, conns);
    expect(path).toEqual({ panelId: 'tab', connectionIds: ['c3', 'c2', 'c1'], symbolIds: ['p3', 'p2', 'p1', 'tab'] });
  });

  it('prend le chemin le plus court et ignore les liaisons « Information »', () => {
    const conns = [
      link('c1', 'tab', 'p1'),
      link('c2', 'p1', 'p2'),
      link('direct', 'p2', 'tab', 'information'),
      link('c4', 'i1', 'l1', 'command'),
      link('c5', 'l1', 'tab'),
    ];
    expect(findSupplyPath('p2', symbols, conns)?.connectionIds).toEqual(['c2', 'c1']);
    expect(findSupplyPath('i1', symbols, conns)?.connectionIds).toEqual(['c4', 'c5']);
  });

  it('renvoie null sans liaison vers le tableau', () => {
    expect(findSupplyPath('p1', symbols, [link('c2', 'p1', 'p2')])).toBeNull();
    expect(findSupplyPath('tab', symbols, [link('c1', 'tab', 'p1')])).toBeNull();
  });

  it('tracé indicatif : du tableau vers l’élément en passant par les éléments du circuit les plus proches', () => {
    expect(indicativeChain(panel, p3, [p1, p2, p3])).toEqual(['tab', 'p1', 'p2', 'p3']);
    // Un élément éloigné du chemin n'est pas traversé
    const far = sym('far', 'prise-16a', -900, 900);
    expect(indicativeChain(panel, p2, [far, p1, p2])).toEqual(['tab', 'p1', 'p2']);
  });

  it('choisit le « Tableau électrique » en priorité', () => {
    expect(findPanelSymbol([sym('d', 'disjoncteur', 0, 0), panel])?.id).toBe('tab');
    expect(findPanelSymbol([p1])).toBeNull();
  });
});

describe('Étiquette de circuit', () => {
  it('lit calibres et sections', () => {
    expect(parseAmps('C16')).toBe(16);
    expect(parseAmps('20 A')).toBe(20);
    expect(parseAmps('40A 30mA')).toBe(40);
    expect(parseAmps('')).toBeNull();
    expect(parseSection('2,5 mm²')).toBe(2.5);
    expect(parseSection('1.5')).toBe(1.5);
  });

  it('« Circuit 3 – Prises salon – 2,5 mm² – 20 A »', () => {
    expect(circuitLabel({ number: '3', name: 'Prises salon', cableSection: '2,5 mm²', protection: 'C20' })).toBe('Circuit 3 – Prises salon – 2,5 mm² – 20 A');
    expect(circuitLabel({ name: 'Prises cuisine' })).toBe('Circuit – Prises cuisine');
  });
});
