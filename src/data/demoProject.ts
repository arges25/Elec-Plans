import type { Door, ElectricalCircuit, ElectricalConnection, PlacedSymbol, Plan, ProjectBundle, Room, Wall, Window } from '../types';
import { defaultLayers } from '../utils/planFactory';
import { snapSymbol } from '../utils/symbols';
import { getSymbolDefinition } from './electricalSymbols';
import { DEFAULT_TEMPLATE_ID } from './electricalPanelTemplates';

/**
 * Projet de démonstration « Maison Démo » : salon, cuisine, chambre, SDB, entrée,
 * avec prises, RJ45, interrupteurs, va-et-vient, spots, VMC, tableau et liaisons.
 */
export function buildDemoBundle(): ProjectBundle {
  const now = Date.now();
  const projectId = 'demo-project';
  const planId = 'demo-plan';
  const panelId = 'demo-panel';

  const EXT = 16;
  const INT = 10;
  const walls: Wall[] = [
    { id: 'w-top', x1: 100, y1: 100, x2: 1300, y2: 100, thickness: EXT },
    { id: 'w-right', x1: 1300, y1: 100, x2: 1300, y2: 900, thickness: EXT },
    { id: 'w-bottom', x1: 1300, y1: 900, x2: 100, y2: 900, thickness: EXT },
    { id: 'w-left', x1: 100, y1: 900, x2: 100, y2: 100, thickness: EXT },
    { id: 'w-salon-cuisine', x1: 700, y1: 100, x2: 700, y2: 480, thickness: INT },
    { id: 'w-salon-chambre', x1: 100, y1: 560, x2: 900, y2: 560, thickness: INT },
    { id: 'w-chambre-sdb', x1: 600, y1: 560, x2: 600, y2: 900, thickness: INT },
    { id: 'w-sdb-entree', x1: 900, y1: 480, x2: 900, y2: 900, thickness: INT },
    { id: 'w-cuisine-entree', x1: 700, y1: 480, x2: 1300, y2: 480, thickness: INT },
  ];
  const doors: Door[] = [
    { id: 'd-entree', wallId: 'w-right', t: 0.74, width: 90, flip: true, hingeEnd: false },
    { id: 'd-chambre', wallId: 'w-salon-chambre', t: 0.525, width: 80, flip: false, hingeEnd: false },
    { id: 'd-sdb', wallId: 'w-sdb-entree', t: 0.76, width: 75, flip: true, hingeEnd: true },
    { id: 'd-cuisine', wallId: 'w-cuisine-entree', t: 0.5, width: 85, flip: false, hingeEnd: false },
    { id: 'd-salon', wallId: 'w-salon-cuisine', t: 0.74, width: 90, flip: true, hingeEnd: false },
  ];
  const windows: Window[] = [
    { id: 'f-salon', wallId: 'w-top', t: 0.25, width: 150 },
    { id: 'f-cuisine', wallId: 'w-top', t: 0.9167, width: 100 },
    { id: 'f-chambre', wallId: 'w-left', t: 0.2125, width: 120 },
    { id: 'f-sdb', wallId: 'w-bottom', t: 0.458, width: 70 },
    { id: 'f-salon2', wallId: 'w-left', t: 0.7125, width: 140 },
  ];
  const rooms: Room[] = [
    { id: 'r-salon', name: 'Salon', x: 420, y: 250 },
    { id: 'r-cuisine', name: 'Cuisine', x: 1000, y: 300 },
    { id: 'r-chambre', name: 'Chambre', x: 350, y: 800 },
    { id: 'r-sdb', name: 'SDB', x: 750, y: 820 },
    { id: 'r-entree', name: 'Entrée', x: 1100, y: 750 },
  ];

  // Circuits
  const row1 = { id: 'demo-row-1', name: 'Rangée 1' };
  const row2 = { id: 'demo-row-2', name: 'Rangée 2' };
  let order = 0;
  const circuit = (
    rowId: string,
    number: string,
    name: string,
    protection: string,
    section: string,
    kind: ElectricalCircuit['kind'] = 'circuit',
    modules = 1,
    icon?: string,
  ): ElectricalCircuit => ({
    id: `demo-c-${order}`,
    panelId,
    rowId,
    order: order++,
    number,
    name,
    kind,
    modules,
    protection,
    cableSection: section,
    icon,
  });
  const circuits: ElectricalCircuit[] = [
    circuit(row1.id, '', 'Différentiel 40A 30mA type AC', '40A 30mA', '10 mm²', 'differential', 2, 'interrupteur-differentiel'),
    circuit(row1.id, '1', 'Éclairage salon / entrée', 'C10', '1,5 mm²', 'circuit', 1, 'point-lumineux'),
    circuit(row1.id, '2', 'Éclairage chambre / SDB', 'C10', '1,5 mm²', 'circuit', 1, 'point-lumineux'),
    circuit(row1.id, '3', 'Prises salon', 'C16', '2,5 mm²', 'circuit', 1, 'prise-16a'),
    circuit(row1.id, '4', 'Prises chambre', 'C16', '2,5 mm²', 'circuit', 1, 'prise-16a'),
    circuit(row1.id, '5', 'VMC', 'C2', '1,5 mm²', 'circuit', 1, 'bouche-vmc'),
    circuit(row1.id, '6', 'Chauffe-eau', 'C20', '2,5 mm²', 'circuit', 1, 'chauffe-eau'),
    circuit(row1.id, '7', 'Sèche-serviettes', 'C16', '1,5 mm²', 'circuit', 1, 'seche-serviettes'),
    circuit(row2.id, '', 'Différentiel 40A 30mA type A', '40A 30mA', '10 mm²', 'differential', 2, 'interrupteur-differentiel'),
    circuit(row2.id, '8', 'Prises cuisine', 'C20', '2,5 mm²', 'circuit', 1, 'prise-16a'),
    circuit(row2.id, '9', 'Four', 'C20', '2,5 mm²', 'circuit', 1, 'four'),
    circuit(row2.id, '10', 'Plaque de cuisson', 'C32', '6 mm²', 'circuit', 1, 'plaque-cuisson'),
    circuit(row2.id, '11', 'Lave-vaisselle', 'C20', '2,5 mm²', 'circuit', 1, 'lave-vaisselle'),
    circuit(row2.id, '12', 'Lave-linge', 'C20', '2,5 mm²', 'circuit', 1, 'lave-linge'),
    circuit(row2.id, '13', 'Prises SDB / entrée', 'C16', '2,5 mm²', 'circuit', 1, 'prise-16a'),
  ];
  const cByNum = (n: string) => circuits.find((c) => c.number === n)!;

  // Symboles (les symboles muraux sont aimantés au mur le plus proche)
  const symbols: PlacedSymbol[] = [];
  let sIdx = 0;
  const place = (symbolType: string, x: number, y: number, room: string, circuitNumber?: string, label?: string): string => {
    const def = getSymbolDefinition(symbolType);
    const snap = snapSymbol(def, 1, { x, y }, walls, 60);
    const c = circuitNumber ? cByNum(circuitNumber) : undefined;
    const id = `demo-s-${sIdx++}`;
    symbols.push({
      id,
      projectId,
      planId,
      symbolType,
      x: snap?.x ?? x,
      y: snap?.y ?? y,
      rotation: snap?.rotation ?? 0,
      scale: 1,
      properties: {
        room,
        label,
        circuitId: c?.id,
        circuitName: c?.name,
        circuitNumber: c?.number,
        breaker: c?.protection,
        cableSection: c?.cableSection,
      },
    });
    return id;
  };

  // Salon
  place('prise-16a', 130, 220, 'Salon', '3');
  place('prise-double-16a', 320, 540, 'Salon', '3');
  place('prise-tv', 200, 540, 'Salon');
  place('prise-rj45', 130, 470, 'Salon');
  place('prise-16a', 600, 120, 'Salon', '3');
  const salonL1 = place('point-lumineux', 290, 340, 'Salon', '1');
  const salonL2 = place('point-lumineux', 540, 340, 'Salon', '1');
  const vv1 = place('va-et-vient', 680, 450, 'Salon', '1');
  const vv2 = place('va-et-vient', 160, 120, 'Salon', '1');
  // Cuisine
  place('prise-double-16a', 850, 120, 'Cuisine', '8');
  place('prise-32a', 1000, 120, 'Cuisine', '10', 'Plaque');
  place('prise-16a', 1100, 120, 'Cuisine', '8');
  place('prise-20a', 1280, 250, 'Cuisine', '11', 'Lave-vaisselle');
  place('prise-20a', 1280, 380, 'Cuisine', '9', 'Four');
  const spotsCuisine = [
    place('spot-encastre', 850, 230, 'Cuisine', '1'),
    place('spot-encastre', 1150, 230, 'Cuisine', '1'),
    place('spot-encastre', 850, 380, 'Cuisine', '1'),
    place('spot-encastre', 1150, 380, 'Cuisine', '1'),
  ];
  const interCuisine = place('inter-simple', 940, 462, 'Cuisine', '1');
  place('bouche-extraction', 1240, 430, 'Cuisine', '5');
  // Chambre
  place('prise-16a', 130, 620, 'Chambre', '4');
  place('prise-16a', 130, 860, 'Chambre', '4');
  place('prise-16a', 582, 800, 'Chambre', '4');
  place('rj45-cat6', 330, 882, 'Chambre');
  const lChambre = place('point-lumineux', 350, 700, 'Chambre', '2');
  const interChambre = place('inter-simple', 585, 625, 'Chambre', '2');
  // SDB
  const spotsSdb = [place('spot', 700, 680, 'SDB', '2'), place('spot', 800, 680, 'SDB', '2')];
  const applique = place('applique-murale', 750, 578, 'SDB', '2');
  const interSdb = place('inter-double', 882, 720, 'SDB', '2');
  place('bouche-extraction', 650, 620, 'SDB', '5');
  place('seche-serviettes', 618, 760, 'SDB', '7');
  place('prise-16a', 880, 610, 'SDB', '13');
  // Entrée
  place('tableau-electrique', 1280, 570, 'Entrée');
  const lEntree = place('point-lumineux', 1100, 640, 'Entrée', '1');
  const bp1 = place('bouton-poussoir', 1282, 830, 'Entrée', '1');
  const bp2 = place('bouton-poussoir', 920, 530, 'Entrée', '1');
  place('detecteur-fumee', 1000, 620, 'Entrée');
  place('prise-16a', 1100, 882, 'Entrée', '13');

  // Liaisons
  const connections: ElectricalConnection[] = [];
  let cIdx = 0;
  const link = (sourceId: string, targetId: string, group: number | undefined, type: ElectricalConnection['type'] = 'command', curvature = 0.25) => {
    connections.push({
      id: `demo-l-${cIdx++}`,
      projectId,
      planId,
      sourceId,
      targetId,
      type,
      color: type === 'command' ? '#f97316' : type === 'circuit' ? '#2563eb' : '#6b7280',
      width: 2,
      dash: type === 'circuit' ? 'long' : 'dash',
      curvature,
      group,
      showLabel: type === 'command',
    });
  };
  link(vv1, salonL1, 1, 'command', 0.2);
  link(vv2, salonL1, 1, 'command', -0.2);
  link(salonL1, salonL2, undefined, 'circuit', 0.15);
  spotsCuisine.forEach((s, i) => link(interCuisine, s, 2, 'command', i % 2 ? -0.2 : 0.2));
  link(interChambre, lChambre, 3, 'command', 0.25);
  spotsSdb.forEach((s) => link(interSdb, s, 4, 'command', 0.2));
  link(interSdb, applique, 5, 'command', -0.25);
  link(bp1, lEntree, 6, 'command', 0.2);
  link(bp2, lEntree, 6, 'command', -0.2);

  const plan: Plan = {
    id: planId,
    projectId,
    name: 'RDC',
    floorType: 'rdc',
    order: 0,
    source: 'blank',
    backgroundOpacity: 1,
    vectorData: {
      walls,
      doors,
      windows,
      rooms,
      annotations: [
        { id: 'a-1', kind: 'text', x: 760, y: 22, text: 'Prises plan de travail à 110 cm', fontSize: 22, color: '#111827', strokeWidth: 2 },
        { id: 'a-2', kind: 'arrow', x: 0, y: 0, points: [900, 50, 880, 96], color: '#111827', strokeWidth: 2 },
        { id: 'a-3', kind: 'text', x: 110, y: 990, text: 'Prévoir alimentation portail', fontSize: 22, color: '#15803d', strokeWidth: 2 },
      ],
      measures: [{ id: 'm-1', x1: 100, y1: 950, x2: 1300, y2: 950 }],
    },
    width: 1400,
    height: 1040,
    scale: { pixelsPerMeter: 100, reference: { x1: 100, y1: 950, x2: 1300, y2: 950, meters: 12 } },
    layers: defaultLayers(),
    reconstructed: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    format: 'mgeplan',
    version: 1,
    app: 'MG Elec & Plans',
    exportedAt: new Date(now).toISOString(),
    project: {
      id: projectId,
      name: 'Maison Démo',
      clientName: 'M. et Mme Martin',
      address: '12 rue des Lilas',
      city: 'Lyon',
      notes: 'Projet de démonstration : plan simplifié, symboles, liaisons et tableau.',
      date: new Date(now).toISOString().slice(0, 10),
      floors: [{ planId, name: 'RDC', type: 'rdc' }],
      createdAt: now,
      updatedAt: now,
      isDemo: true,
    },
    plans: [plan],
    symbols,
    connections,
    panels: [
      {
        id: panelId,
        projectId,
        name: 'Maison Démo',
        templateId: DEFAULT_TEMPLATE_ID,
        rows: [row1, row2],
        createdAt: now,
        updatedAt: now,
      },
    ],
    circuits,
    labels: [],
  };
}
