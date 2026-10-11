import { describe, expect, it } from 'vitest';
import type { ElectricalCircuit, PlacedSymbol, Plan } from '../types';
import { buildDemoBundle } from '../data/demoProject';
import { NFC15100_RULES } from '../data/nfc15100';
import { buildRecap, inferRoom, planAutoDistribution, UNKNOWN_ROOM } from '../services/panelRecap';
import { createPlan } from '../utils/planFactory';

let n = 0;
const sym = (symbolType: string, room: string, props: Partial<PlacedSymbol['properties']> = {}, planId = 'pl1', x = n * 10, y = 0): PlacedSymbol => ({
  id: `s${n++}`,
  projectId: 'p',
  planId,
  symbolType,
  x,
  y,
  rotation: 0,
  scale: 1,
  properties: { room, ...props },
});
const circuit = (id: string, number: string, name: string, protection: string, cableSection: string): ElectricalCircuit => ({
  id,
  panelId: 'pnl',
  rowId: 'r1',
  order: Number(number),
  number,
  name,
  kind: 'circuit',
  modules: 1,
  protection,
  cableSection,
});
const plan = (id: string, name: string, order: number): Plan => ({ ...createPlan('p', name, 'custom', order), id });
const plans = [plan('pl1', 'RDC', 0), plan('pl2', 'Étage 1', 1)];
const idSeq = () => {
  let i = 0;
  return (p: string) => `${p}-new-${++i}`;
};

describe('Récapitulatif du projet de démonstration', () => {
  const demo = buildDemoBundle();
  const recap = buildRecap({ plans: demo.plans, symbols: demo.symbols, circuits: demo.circuits });
  const byNumber = (num: string) => recap.circuits.find((c) => c.number === num)!;

  it('compte prises, commandes et points lumineux par pièce', () => {
    const salon = recap.rooms.find((r) => r.room === 'Salon')!;
    expect(salon).toMatchObject({ floorName: 'RDC', sockets: 3, switches: 2, lights: 2, dedicated: 0 });
    const cuisine = recap.rooms.find((r) => r.room === 'Cuisine')!;
    expect(cuisine).toMatchObject({ sockets: 2, switches: 1, lights: 4, dedicated: 3 });
    expect(recap.totals.lights).toBe(11);
  });

  it('vérifie chaque circuit : vert, orange (proche de la limite), gris (non vérifié)', () => {
    expect(byNumber('3')).toMatchObject({ type: 'prises', count: 3, max: 12, status: 'ok', sectionMm2: 2.5, breakerA: 16 });
    // 7 points lumineux sur 8 : proche de la limite
    expect(byNumber('1')).toMatchObject({ type: 'eclairage', count: 7, max: 8, status: 'warn' });
    expect(byNumber('1').messages[0]).toContain('Proche de la limite');
    expect(byNumber('10')).toMatchObject({ type: 'specialise', status: 'ok' });
    expect(byNumber('10').dedicatedRule?.id).toBe('plaque');
    expect(byNumber('9').dedicatedRule?.id).toBe('four');
    expect(byNumber('5')).toMatchObject({ type: 'specialise', status: 'ok' });
    expect(byNumber('7')).toMatchObject({ type: 'autre', status: 'unknown' });
    expect(recap.statusCount.error).toBe(0);
  });

  it('liste le matériel : disjoncteurs par calibre, différentiels, coffret', () => {
    const qty = (label: string) => recap.material.find((l) => l.label === label)?.qty;
    expect(qty('Disjoncteur divisionnaire 1P+N 10 A')).toBe(2);
    expect(qty('Disjoncteur divisionnaire 1P+N 16 A')).toBe(4);
    expect(qty('Disjoncteur divisionnaire 1P+N 20 A')).toBe(5);
    expect(qty('Disjoncteur divisionnaire 1P+N 32 A')).toBe(1);
    expect(qty('Disjoncteur divisionnaire 1P+N 2 A')).toBe(1);
    expect(qty('Interrupteur différentiel 30 mA type A')).toBe(1);
    expect(qty('Interrupteur différentiel 30 mA type AC')).toBe(1);
    expect(qty('Contacteur heures creuses')).toBe(1);
    expect(qty('Coffret 2 rangées de 13 modules')).toBe(1);
  });
});

describe('Contrôle NF C 15-100', () => {
  it('rouge au-delà de 12 prises en 2,5 mm² / 20 A, puis découpage automatique', () => {
    const c = circuit('c1', '1', 'Prises séjour', 'C20', '2,5 mm²');
    const symbols = Array.from({ length: 14 }, () => sym('prise-16a', 'Séjour', { circuitId: 'c1' }));
    const r = buildRecap({ plans, symbols, circuits: [c] }).circuits[0];
    expect(r).toMatchObject({ count: 14, max: 12, status: 'error' });
    expect(r.messages[0]).toBe('Limite dépassée : 14 prises pour 12 maximum');
    const d = planAutoDistribution({ plans, symbols, circuits: [c] }, idSeq());
    expect(d.newCircuits).toHaveLength(1);
    expect(d.newCircuits[0]).toMatchObject({ name: 'Prises séjour 2', protection: 'C20', cableSection: '2,5 mm²', number: '2' });
    expect(d.assignments).toHaveLength(2);
  });

  it('1,5 mm² : 8 prises maximum et 16 A maximum', () => {
    const c = circuit('c1', '1', 'Prises chambre', 'C20', '1,5 mm²');
    const symbols = Array.from({ length: 7 }, () => sym('prise-16a', 'Chambre', { circuitId: 'c1' }));
    const r = buildRecap({ plans, symbols, circuits: [c] }).circuits[0];
    expect(r.max).toBe(8);
    expect(r.status).toBe('error');
    expect(r.messages).toContain('Disjoncteur 20 A trop fort pour 1,5 mm² (16 A maximum)');
  });

  it('une prise double compte pour 1 point (réglable)', () => {
    const c = circuit('c1', '1', 'Prises', 'C20', '2,5 mm²');
    const symbols = [sym('prise-double-16a', 'Salon', { circuitId: 'c1' }), sym('prise-16a', 'Salon', { circuitId: 'c1' })];
    expect(buildRecap({ plans, symbols, circuits: [c] }).circuits[0].count).toBe(2);
    const rules = { ...NFC15100_RULES, multiSocketPoints: 2 };
    expect(buildRecap({ plans, symbols, circuits: [c], rules }).circuits[0].count).toBe(3);
  });

  it('circuit mixte prises + éclairage : rouge, éclairage déplacé sur un circuit d’éclairage', () => {
    const c = circuit('c1', '1', 'Salon', 'C16', '1,5 mm²');
    const symbols = [
      sym('prise-16a', 'Salon', { circuitId: 'c1' }),
      sym('point-lumineux', 'Salon', { circuitId: 'c1' }),
      sym('inter-simple', 'Salon', { circuitId: 'c1' }),
    ];
    const r = buildRecap({ plans, symbols, circuits: [c] }).circuits[0];
    expect(r.type).toBe('mixte');
    expect(r.status).toBe('error');
    const d = planAutoDistribution({ plans, symbols, circuits: [c] }, idSeq());
    expect(d.newCircuits.map((x) => [x.name, x.protection, x.cableSection])).toEqual([['Éclairage Salon', 'C16', '1,5 mm²']]);
    expect(d.assignments.map((a) => a.symbolId)).toEqual([symbols[1].id, symbols[2].id]);
  });

  it('circuit spécialisé : 1 appareil, section et calibre de l’appareil', () => {
    const c = circuit('c1', '1', 'Cuisine', 'C20', '2,5 mm²');
    const symbols = [sym('lave-vaisselle', 'Cuisine', { circuitId: 'c1' }), sym('four', 'Cuisine', { circuitId: 'c1' })];
    const r = buildRecap({ plans, symbols, circuits: [c] }).circuits[0];
    expect(r).toMatchObject({ type: 'specialise', count: 2, max: 1, status: 'error' });
    const plaque = circuit('c2', '2', 'Plaque', 'C32', '2,5 mm²');
    const r2 = buildRecap({ plans, symbols: [sym('plaque-induction', 'Cuisine', { circuitId: 'c2' })], circuits: [plaque] }).circuits[0];
    expect(r2.messages).toContain('Section 2,5 mm² insuffisante (6 mm² requis)');
  });
});

describe('Répartition automatique des éléments sans circuit', () => {
  it('regroupe les pièces d’un même niveau et crée les circuits dédiés', () => {
    const symbols = [
      ...Array.from({ length: 5 }, () => sym('prise-16a', 'Chambre 1')),
      ...Array.from({ length: 4 }, () => sym('prise-16a', 'Chambre 2')),
      ...Array.from({ length: 3 }, () => sym('prise-16a', 'Bureau', {}, 'pl2')),
      sym('point-lumineux', 'Chambre 1'),
      sym('inter-simple', 'Chambre 1'),
      sym('lave-linge', 'Buanderie'),
      sym('radiateur', 'Chambre 1'),
    ];
    const d = planAutoDistribution({ plans, symbols, circuits: [] }, idSeq());
    expect(d.newCircuits.map((c) => `${c.number} ${c.name} ${c.protection} ${c.cableSection}`)).toEqual([
      '1 Lave-linge C20 2,5 mm²',
      '2 Prises Chambre 1 / Chambre 2 C20 2,5 mm²',
      '3 Prises Bureau C20 2,5 mm²',
      '4 Éclairage Chambre 1 C16 1,5 mm²',
    ]);
    expect(d.leftover).toBe(1); // radiateur
    expect(d.summary[0]).toBe('4 circuits créés');
    // Après répartition : plus rien à faire
    const applied = symbols.map((s) => {
      const a = d.assignments.find((x) => x.symbolId === s.id);
      return a ? { ...s, properties: { ...s.properties, circuitId: a.circuitId } } : s;
    });
    const circuits = d.newCircuits.map((c, i) => ({ ...c, panelId: 'pnl', rowId: 'r1', order: i, kind: 'circuit' as const, modules: 1 }));
    const recap = buildRecap({ plans, symbols: applied, circuits });
    expect(recap.statusCount.error).toBe(0);
    expect(recap.unassigned.map((e) => e.symbol.symbolType)).toEqual(['radiateur']);
  });

  it('utilise un circuit dédié vide existant (même appareil)', () => {
    const ll = circuit('c9', '9', 'Lave-linge', 'C20', '2,5 mm²');
    const s = sym('lave-linge', 'Buanderie');
    const d = planAutoDistribution({ plans, symbols: [s], circuits: [ll] }, idSeq());
    expect(d.newCircuits).toHaveLength(0);
    expect(d.assignments).toEqual([{ symbolId: s.id, circuitId: 'c9' }]);
  });
});

describe('Pièce déduite du plan', () => {
  it('étiquette de pièce la plus proche sans traverser de mur', () => {
    const rooms = [
      { id: 'a', name: 'Salon', x: 100, y: 100 },
      { id: 'b', name: 'Cuisine', x: 300, y: 100 },
    ];
    const walls = [{ id: 'w', x1: 200, y1: 0, x2: 200, y2: 400, thickness: 10 }];
    // Plus proche de « Cuisine » mais du côté du salon
    expect(inferRoom({ x: 190, y: 100 }, rooms, walls)).toBe('Salon');
    expect(inferRoom({ x: 210, y: 300 }, rooms, walls)).toBe('Cuisine');
    expect(inferRoom({ x: 190, y: 100 }, [], walls)).toBeNull();
    expect(UNKNOWN_ROOM).toBe('Pièce non renseignée');
  });
});
