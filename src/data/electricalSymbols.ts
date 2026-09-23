import type { ElectricalSymbolDefinition, SymbolCategoryId } from '../types';
import {
  WALL_BACK,
  applianceBox,
  bellGlyph,
  breakerMark,
  c,
  cameraGlyph,
  categoryFactory,
  circleLabel,
  clockGlyph,
  commOutlet,
  dinModule,
  dot,
  earthGlyph,
  fanBlades,
  filled,
  floodGlyph,
  intermediateGlyph,
  lightGlyph,
  line,
  motionGlyph,
  multiSocket,
  p,
  pushButtonGlyph,
  recessedSpotGlyph,
  rect,
  socket,
  spotGlyph,
  squareLabel,
  switchGlyph,
  t,
  twoWayGlyph,
  wallBox,
  wallLightGlyph,
  wifi,
} from './symbolShapes';

/**
 * BIBLIOTHÈQUE DES SYMBOLES ÉLECTRIQUES — MG Elec & Plans
 *
 * Pour ajouter un symbole : ajouter une entrée dans la catégorie voulue.
 *  - `id` unique (kebab-case, préfixé par la catégorie) ;
 *  - `shapes` : primitives dessinées dans une boîte 40 × 40 centrée sur (0, 0),
 *    le dos des symboles muraux est en haut (y = -16) ;
 *  - `keywords` : mots utilisés par la recherche.
 * Les symboles sont génériques (pas de reproduction de symboles propriétaires).
 */

/* ------------------------------------------------------------------ */
/* PRISES                                                              */
/* ------------------------------------------------------------------ */
const prise = categoryFactory('prises', { snapToWall: true, defaultSize: 34 });
const PRISES: ElectricalSymbolDefinition[] = [
  prise({
    id: 'prise-16a',
    name: 'Prise 16A',
    subCategory: 'Prises de courant',
    shapes: socket(),
    keywords: ['pc', '2p+t', 'courant', 'socket'],
    description: 'Prise de courant 2P+T 16 A',
  }),
  prise({ id: 'prise-double-16a', name: 'Prise double 16A', subCategory: 'Prises de courant', shapes: multiSocket(2), keywords: ['double', 'pc'] }),
  prise({ id: 'prise-triple', name: 'Prise triple', subCategory: 'Prises de courant', shapes: multiSocket(3), keywords: ['triple', 'pc', 'bloc'] }),
  prise({ id: 'prise-quadruple', name: 'Prise quadruple', subCategory: 'Prises de courant', shapes: multiSocket(4), keywords: ['quadruple', 'pc', 'bloc'] }),
  prise({
    id: 'prise-20a',
    name: 'Prise 20A',
    subCategory: 'Prises spécialisées',
    shapes: socket('20A', { fill: 'color' }),
    keywords: ['20a', 'spécialisée', 'lave-linge', 'four'],
  }),
  prise({
    id: 'prise-32a',
    name: 'Prise 32A',
    subCategory: 'Prises spécialisées',
    shapes: socket('32A', { fill: 'color' }),
    keywords: ['32a', 'cuisson', 'plaque'],
  }),
  prise({
    id: 'prise-specialisee',
    name: 'Prise spécialisée',
    subCategory: 'Prises spécialisées',
    shapes: socket('SPE', { fill: 'color' }),
    keywords: ['spécialisée', 'dédiée', 'circuit'],
  }),
  prise({
    id: 'prise-ext-ip44',
    name: 'Prise extérieure IP44',
    subCategory: 'Prises extérieures',
    shapes: socket('IP44'),
    keywords: ['extérieure', 'ip44', 'jardin', 'terrasse'],
  }),
  prise({
    id: 'prise-ext-ip55',
    name: 'Prise extérieure IP55',
    subCategory: 'Prises extérieures',
    shapes: socket('IP55'),
    keywords: ['extérieure', 'ip55', 'jardin'],
  }),
  prise({
    id: 'prise-etanche',
    name: 'Prise étanche',
    subCategory: 'Prises extérieures',
    shapes: [...socket(), c(0, -8, 13, 'none', 1.2)],
    keywords: ['étanche', 'humide', 'sdb'],
  }),
  prise({
    id: 'prise-sol',
    name: 'Prise de sol',
    subCategory: 'Prises de courant',
    shapes: [rect(-15, -15, 30, 30, 'none', 1.6), ...socket()],
    keywords: ['sol', 'plancher', 'boîte de sol'],
    snapToWall: false,
  }),
  prise({ id: 'prise-usb-a', name: 'Prise USB A', subCategory: 'Prises USB', shapes: socket('USB-A'), keywords: ['usb', 'chargeur'] }),
  prise({ id: 'prise-usb-c', name: 'Prise USB C', subCategory: 'Prises USB', shapes: socket('USB-C'), keywords: ['usb', 'type-c', 'chargeur'] }),
  prise({ id: 'prise-usb-ac', name: 'Prise USB A+C', subCategory: 'Prises USB', shapes: socket('A+C'), keywords: ['usb', 'chargeur', 'type-c'] }),
  prise({
    id: 'borne-recharge-ve',
    name: 'Borne recharge VE',
    subCategory: 'Mobilité électrique',
    shapes: [rect(-11, WALL_BACK, 22, 30, 'white'), filled('M2 -12L-5 0H0L-2 9L6 -3H1Z')],
    keywords: ['borne', 'recharge', 'voiture', 've', 'irve', 'wallbox'],
    defaultSize: 40,
  }),
];

/* ------------------------------------------------------------------ */
/* RÉSEAU / COMMUNICATION                                              */
/* ------------------------------------------------------------------ */
const reseau = categoryFactory('reseau', { snapToWall: true, defaultSize: 34 });
const RESEAU: ElectricalSymbolDefinition[] = [
  reseau({ id: 'prise-tv', name: 'Prise TV', subCategory: 'Télévision', shapes: commOutlet('TV'), keywords: ['tv', 'télé', 'antenne'] }),
  reseau({ id: 'prise-coaxiale', name: 'Prise coaxiale', subCategory: 'Télévision', shapes: commOutlet('COAX'), keywords: ['coaxiale', 'coax', 'antenne'] }),
  reseau({ id: 'prise-satellite', name: 'Prise satellite', subCategory: 'Télévision', shapes: commOutlet('SAT'), keywords: ['satellite', 'parabole'] }),
  reseau({ id: 'prise-telephone', name: 'Prise téléphone', subCategory: 'Téléphonie', shapes: commOutlet('TEL'), keywords: ['téléphone', 't', 'ligne'] }),
  reseau({
    id: 'prise-rj45',
    name: 'Prise RJ45',
    subCategory: 'Réseau informatique',
    shapes: commOutlet('RJ45'),
    keywords: ['rj45', 'réseau', 'ethernet', 'internet', 'grade'],
  }),
  reseau({
    id: 'rj45-simple',
    name: 'RJ45 simple',
    subCategory: 'Réseau informatique',
    shapes: commOutlet('RJ45', '×1'),
    keywords: ['rj45', 'simple', 'réseau'],
  }),
  reseau({
    id: 'rj45-double',
    name: 'RJ45 double',
    subCategory: 'Réseau informatique',
    shapes: commOutlet('RJ45', '×2'),
    keywords: ['rj45', 'double', 'réseau'],
  }),
  reseau({ id: 'rj45-cat6', name: 'RJ45 Cat6', subCategory: 'Réseau informatique', shapes: commOutlet('RJ45', 'CAT6'), keywords: ['rj45', 'cat6', 'grade 2'] }),
  reseau({
    id: 'rj45-cat6a',
    name: 'RJ45 Cat6A',
    subCategory: 'Réseau informatique',
    shapes: commOutlet('RJ45', 'CAT6A'),
    keywords: ['rj45', 'cat6a', 'grade 3'],
  }),
  reseau({ id: 'prise-fibre', name: 'Fibre', subCategory: 'Réseau informatique', shapes: commOutlet('FO'), keywords: ['fibre', 'optique', 'pto', 'fo'] }),
  reseau({
    id: 'sortie-cable',
    name: 'Sortie câble',
    subCategory: 'Sorties',
    shapes: [line(0, WALL_BACK, 0, -2), c(0, 2, 4, 'white'), line(-8, WALL_BACK, 8, WALL_BACK)],
    keywords: ['sortie', 'câble', 'attente', 'boîte'],
    description: 'Sortie de câble / attente',
  }),
];

/* ------------------------------------------------------------------ */
/* COMMANDES                                                           */
/* ------------------------------------------------------------------ */
const cmd = categoryFactory('commandes', { snapToWall: true, defaultSize: 32 });
const COMMANDES: ElectricalSymbolDefinition[] = [
  cmd({
    id: 'inter-simple',
    name: 'Interrupteur simple',
    subCategory: 'Interrupteurs',
    shapes: switchGlyph(1),
    keywords: ['inter', 'simple allumage', 'sa', 'switch'],
  }),
  cmd({ id: 'inter-double', name: 'Interrupteur double', subCategory: 'Interrupteurs', shapes: switchGlyph(2), keywords: ['inter', 'double allumage', 'da'] }),
  cmd({ id: 'inter-triple', name: 'Interrupteur triple', subCategory: 'Interrupteurs', shapes: switchGlyph(3), keywords: ['inter', 'triple'] }),
  cmd({ id: 'va-et-vient', name: 'Va-et-vient', subCategory: 'Interrupteurs', shapes: twoWayGlyph(), keywords: ['vv', 'va et vient', 'deux directions'] }),
  cmd({
    id: 'double-va-et-vient',
    name: 'Double va-et-vient',
    subCategory: 'Interrupteurs',
    shapes: twoWayGlyph(true),
    keywords: ['vv', 'double', 'va et vient'],
  }),
  cmd({
    id: 'permutateur',
    name: 'Permutateur',
    subCategory: 'Interrupteurs',
    shapes: intermediateGlyph(),
    keywords: ['permutateur', 'intermédiaire', 'croisement'],
  }),
  cmd({ id: 'bouton-poussoir', name: 'Bouton poussoir', subCategory: 'Poussoirs', shapes: pushButtonGlyph(), keywords: ['bp', 'poussoir', 'télérupteur'] }),
  cmd({
    id: 'double-bouton-poussoir',
    name: 'Double bouton poussoir',
    subCategory: 'Poussoirs',
    shapes: pushButtonGlyph(true),
    keywords: ['bp', 'double', 'poussoir'],
  }),
  cmd({
    id: 'variateur',
    name: 'Variateur',
    subCategory: 'Interrupteurs',
    shapes: [...switchGlyph(1), p('M-12 8L-3 -1', 'none', 1.6), filled('M-3 -1L-7.5 0L-4 -4.5Z')],
    keywords: ['variateur', 'dimmer', 'gradateur'],
  }),
  cmd({
    id: 'inter-temporise',
    name: 'Interrupteur temporisé',
    subCategory: 'Interrupteurs',
    shapes: [...switchGlyph(1), t('t', -9, 5, 9)],
    keywords: ['temporisé', 'minuterie', 'tempo'],
  }),
  cmd({
    id: 'inter-crepusculaire',
    name: 'Interrupteur crépusculaire',
    subCategory: 'Interrupteurs',
    shapes: [...switchGlyph(1), t('LUX', -8, 8, 6)],
    keywords: ['crépusculaire', 'luminosité', 'nuit'],
  }),
  cmd({
    id: 'inter-connecte',
    name: 'Interrupteur connecté',
    subCategory: 'Interrupteurs',
    shapes: [...switchGlyph(1), ...wifi(-9, 5, 0.8)],
    keywords: ['connecté', 'wifi', 'zigbee', 'domotique'],
  }),
  cmd({
    id: 'commande-volet',
    name: 'Commande volet',
    subCategory: 'Volets / stores',
    shapes: [rect(-10, WALL_BACK, 20, 26, 'white'), filled('M0 -13L-5 -6H5Z'), filled('M0 7L-5 0H5Z')],
    keywords: ['volet', 'roulant', 'montée', 'descente'],
  }),
  cmd({
    id: 'commande-store',
    name: 'Commande store',
    subCategory: 'Volets / stores',
    shapes: [rect(-10, WALL_BACK, 20, 26, 'white'), filled('M0 -13L-5 -7H5Z'), filled('M0 3L-5 -3H5Z'), t('S', 0, 7.5, 5.5)],
    keywords: ['store', 'banne', 'screen'],
  }),
  cmd({
    id: 'commande-vmc',
    name: 'Commande VMC',
    subCategory: 'Ventilation',
    shapes: [...wallBox('VMC', 6.5)],
    keywords: ['vmc', 'grande vitesse', 'commande'],
  }),
  cmd({
    id: 'cmd-telerupteur',
    name: 'Télérupteur',
    subCategory: 'Automatismes',
    shapes: squareLabel('TL'),
    keywords: ['télérupteur', 'tl', 'poussoir'],
    snapToWall: false,
  }),
  cmd({
    id: 'cmd-telerupteur-minuterie',
    name: 'Télérupteur minuterie',
    subCategory: 'Automatismes',
    shapes: squareLabel('TLM'),
    keywords: ['télérupteur', 'minuterie'],
    snapToWall: false,
  }),
  cmd({
    id: 'cmd-minuterie',
    name: 'Minuterie',
    subCategory: 'Automatismes',
    shapes: [...clockGlyph(0, -2, 10), t('MIN', 0, 13, 5.5)],
    keywords: ['minuterie', 'temporisation'],
    snapToWall: false,
  }),
  cmd({
    id: 'cmd-horloge',
    name: 'Horloge',
    subCategory: 'Automatismes',
    shapes: clockGlyph(0, 0, 12),
    keywords: ['horloge', 'programmation', 'heure'],
    snapToWall: false,
  }),
  cmd({ id: 'cmd-thermostat', name: 'Thermostat', subCategory: 'Régulation', shapes: wallBox('T°'), keywords: ['thermostat', 'température', 'régulation'] }),
  cmd({
    id: 'cmd-thermostat-connecte',
    name: 'Thermostat connecté',
    subCategory: 'Régulation',
    shapes: [...wallBox('T°'), ...wifi(0, 12, 0.7)],
    keywords: ['thermostat', 'connecté', 'wifi'],
  }),
];

/* ------------------------------------------------------------------ */
/* ÉCLAIRAGE                                                           */
/* ------------------------------------------------------------------ */
const lum = categoryFactory('eclairage', { snapToWall: false, defaultSize: 34 });
const ECLAIRAGE: ElectricalSymbolDefinition[] = [
  lum({
    id: 'point-lumineux',
    name: 'Point lumineux',
    subCategory: 'Plafond',
    shapes: lightGlyph(0, 0, 10),
    keywords: ['pl', 'lumière', 'plafond', 'luminaire', 'centre'],
  }),
  lum({
    id: 'plafonnier',
    name: 'Plafonnier',
    subCategory: 'Plafond',
    shapes: [...lightGlyph(0, 0, 13), c(0, 0, 16, 'none', 1.2)],
    keywords: ['plafonnier', 'lustre', 'plafond'],
  }),
  lum({
    id: 'dcl',
    name: 'DCL',
    subCategory: 'Plafond',
    shapes: [...lightGlyph(0, -3, 10), t('DCL', 0, 13, 6)],
    keywords: ['dcl', 'douille', 'connexion luminaire'],
    description: 'Dispositif de connexion pour luminaire',
  }),
  lum({ id: 'spot', name: 'Spot', subCategory: 'Spots', shapes: spotGlyph(0, 0, 7), keywords: ['spot', 'led'], defaultSize: 26 }),
  lum({
    id: 'spot-encastre',
    name: 'Spot encastré',
    subCategory: 'Spots',
    shapes: recessedSpotGlyph(0, 0, 8),
    keywords: ['spot', 'encastré', 'downlight'],
    defaultSize: 26,
  }),
  lum({ id: 'double-spot', name: 'Double spot', subCategory: 'Spots', shapes: [...spotGlyph(-8, 0, 6), ...spotGlyph(8, 0, 6)], keywords: ['spot', 'double'] }),
  lum({
    id: 'triple-spot',
    name: 'Triple spot',
    subCategory: 'Spots',
    shapes: [...spotGlyph(-12, 0, 5), ...spotGlyph(0, 0, 5), ...spotGlyph(12, 0, 5)],
    keywords: ['spot', 'triple', 'barre'],
  }),
  lum({
    id: 'rail-spots',
    name: 'Rail spots',
    subCategory: 'Spots',
    shapes: [line(-18, -5, 18, -5, 2.6), ...spotGlyph(-11, 3, 4.5), ...spotGlyph(0, 3, 4.5), ...spotGlyph(11, 3, 4.5)],
    keywords: ['rail', 'spots', 'track'],
  }),
  lum({
    id: 'applique-murale',
    name: 'Applique murale',
    subCategory: 'Murales',
    shapes: wallLightGlyph(),
    keywords: ['applique', 'mur', 'murale'],
    snapToWall: true,
  }),
  lum({
    id: 'applique-exterieure',
    name: 'Applique extérieure',
    subCategory: 'Extérieur',
    shapes: wallLightGlyph('EXT'),
    keywords: ['applique', 'extérieure', 'façade'],
    snapToWall: true,
  }),
  lum({
    id: 'suspension',
    name: 'Suspension',
    subCategory: 'Plafond',
    shapes: [...lightGlyph(0, 3, 10), line(0, -15, 0, -7), line(-4, -15, 4, -15)],
    keywords: ['suspension', 'lustre', 'pendant'],
  }),
  lum({
    id: 'bandeau-led',
    name: 'Bandeau LED',
    subCategory: 'LED',
    shapes: [rect(-18, -5, 36, 10, 'white'), dot(-10, 0, 2), dot(0, 0, 2), dot(10, 0, 2)],
    keywords: ['bandeau', 'led', 'réglette'],
  }),
  lum({
    id: 'ruban-led',
    name: 'Ruban LED',
    subCategory: 'LED',
    shapes: [p('M-18 0H18', 'none', 1.2), dot(-14, 0, 1.8), dot(-7, 0, 1.8), dot(0, 0, 1.8), dot(7, 0, 1.8), dot(14, 0, 1.8), t('LED', 0, 8, 6)],
    keywords: ['ruban', 'led', 'strip'],
  }),
  lum({
    id: 'projecteur-interieur',
    name: 'Projecteur intérieur',
    subCategory: 'Projecteurs',
    shapes: floodGlyph(),
    keywords: ['projecteur', 'intérieur'],
    snapToWall: true,
  }),
  lum({
    id: 'projecteur-exterieur',
    name: 'Projecteur extérieur',
    subCategory: 'Extérieur',
    shapes: floodGlyph('EXT'),
    keywords: ['projecteur', 'extérieur', 'détecteur'],
    snapToWall: true,
  }),
  lum({
    id: 'eclairage-jardin',
    name: 'Éclairage jardin',
    subCategory: 'Extérieur',
    shapes: [...lightGlyph(0, -6, 7), line(0, 1, 0, 14), line(-5, 14, 5, 14)],
    keywords: ['jardin', 'piquet', 'extérieur'],
  }),
  lum({
    id: 'borne-exterieure',
    name: 'Borne extérieure',
    subCategory: 'Extérieur',
    shapes: [rect(-6, -2, 12, 16, 'white'), ...lightGlyph(0, -8, 6)],
    keywords: ['borne', 'allée', 'extérieure'],
  }),
  lum({
    id: 'eclairage-escalier',
    name: 'Éclairage escalier',
    subCategory: 'Murales',
    shapes: [...lightGlyph(0, -6, 7), p('M-14 14H-7V9H0V4H7V-1H14', 'none', 1.6)],
    keywords: ['escalier', 'marche', 'balisage'],
    snapToWall: true,
  }),
  lum({
    id: 'baes',
    name: 'BAES',
    subCategory: 'Sécurité',
    shapes: [rect(-16, -9, 32, 18, 'white'), c(-10, 0, 3.5, 'color', 1), t('BAES', 4, 0, 5.5)],
    keywords: ['baes', 'secours', 'évacuation', 'issue'],
    snapToWall: true,
  }),
  lum({
    id: 'eclairage-secours',
    name: 'Éclairage secours',
    subCategory: 'Sécurité',
    shapes: [rect(-16, -9, 32, 18, 'white'), ...lightGlyph(-9, 0, 5), t('SEC', 5, 0, 6)],
    keywords: ['secours', 'baeh', 'sécurité'],
    snapToWall: true,
  }),
];

/* ------------------------------------------------------------------ */
/* VENTILATION                                                         */
/* ------------------------------------------------------------------ */
const vent = categoryFactory('ventilation', { snapToWall: false, defaultSize: 34 });
const VENTILATION: ElectricalSymbolDefinition[] = [
  vent({
    id: 'bouche-vmc',
    name: 'Bouche VMC',
    subCategory: 'Bouches',
    shapes: [c(0, 0, 12, 'white'), c(0, 0, 6), line(0, -12, 0, -6), line(0, 6, 0, 12), line(-12, 0, -6, 0), line(6, 0, 12, 0)],
    keywords: ['vmc', 'bouche', 'aération'],
  }),
  vent({
    id: 'bouche-extraction',
    name: 'Bouche extraction',
    subCategory: 'Bouches',
    shapes: [c(0, 0, 12, 'white'), line(0, 7, 0, -6), filled('M0 -8L-4.5 -2H4.5Z')],
    keywords: ['extraction', 'bouche', 'vmc'],
  }),
  vent({
    id: 'bouche-insufflation',
    name: 'Bouche insufflation',
    subCategory: 'Bouches',
    shapes: [c(0, 0, 12, 'white'), line(0, -7, 0, 6), filled('M0 8L-4.5 2H4.5Z')],
    keywords: ['insufflation', 'soufflage', 'double flux'],
  }),
  vent({
    id: 'vmc-simple-flux',
    name: 'VMC simple flux',
    subCategory: 'Groupes',
    shapes: [rect(-15, -15, 30, 30, 'white'), ...fanBlades(0, -3, 8), t('SF', 0, 10, 7)],
    keywords: ['vmc', 'simple flux', 'caisson'],
    defaultSize: 40,
  }),
  vent({
    id: 'vmc-double-flux',
    name: 'VMC double flux',
    subCategory: 'Groupes',
    shapes: [rect(-15, -15, 30, 30, 'white'), ...fanBlades(0, -3, 8), t('DF', 0, 10, 7)],
    keywords: ['vmc', 'double flux', 'caisson'],
    defaultSize: 40,
  }),
  vent({
    id: 'extracteur',
    name: 'Extracteur',
    subCategory: 'Ventilateurs',
    shapes: [rect(-13, -13, 26, 26, 'white'), ...fanBlades(0, 0, 9)],
    keywords: ['extracteur', 'aérateur'],
    snapToWall: true,
  }),
  vent({
    id: 'ventilateur',
    name: 'Ventilateur',
    subCategory: 'Ventilateurs',
    shapes: [c(0, 0, 13, 'white'), ...fanBlades(0, 0, 10)],
    keywords: ['ventilateur', 'brasseur'],
  }),
  vent({
    id: 'ventilateur-plafond',
    name: 'Ventilateur plafond',
    subCategory: 'Ventilateurs',
    shapes: [c(0, 0, 15, 'white', 1.2), ...fanBlades(0, 0, 13), c(0, 0, 3.5, 'white')],
    keywords: ['ventilateur', 'plafond', 'brasseur'],
  }),
];

/* ------------------------------------------------------------------ */
/* CHAUFFAGE                                                           */
/* ------------------------------------------------------------------ */
const chauf = categoryFactory('chauffage', { snapToWall: true, defaultSize: 40 });
const radiatorBody = (inner: ReturnType<typeof line>[]) => [rect(-17, WALL_BACK, 34, 12, 'white'), ...inner];
const CHAUFFAGE: ElectricalSymbolDefinition[] = [
  chauf({
    id: 'radiateur',
    name: 'Radiateur',
    subCategory: 'Émetteurs',
    shapes: radiatorBody([line(-10, -16, -10, -4, 1.4), line(-3, -16, -3, -4, 1.4), line(4, -16, 4, -4, 1.4), line(11, -16, 11, -4, 1.4)]),
    keywords: ['radiateur', 'chauffage'],
  }),
  chauf({
    id: 'radiateur-electrique',
    name: 'Radiateur électrique',
    subCategory: 'Émetteurs',
    shapes: [...radiatorBody([p('M-13 -10L-9 -14L-5 -6L-1 -14L3 -6L7 -14L11 -6L13 -10', 'none', 1.4)]), t('RE', 0, 5, 6.5)],
    keywords: ['radiateur', 'électrique', 'inertie'],
  }),
  chauf({
    id: 'convecteur',
    name: 'Convecteur',
    subCategory: 'Émetteurs',
    shapes: [...radiatorBody([p('M-13 -10Q-9.75 -15 -6.5 -10T0 -10T6.5 -10T13 -10', 'none', 1.4)]), t('CV', 0, 5, 6.5)],
    keywords: ['convecteur', 'chauffage'],
  }),
  chauf({
    id: 'panneau-rayonnant',
    name: 'Panneau rayonnant',
    subCategory: 'Émetteurs',
    shapes: [...radiatorBody([line(-13, -12, 13, -12, 1.2), line(-13, -8, 13, -8, 1.2)]), t('PR', 0, 5, 6.5)],
    keywords: ['panneau', 'rayonnant'],
  }),
  chauf({
    id: 'seche-serviettes',
    name: 'Sèche-serviettes',
    subCategory: 'Émetteurs',
    shapes: [
      rect(-10, WALL_BACK, 20, 30, 'white'),
      line(-10, -9, 10, -9, 1.4),
      line(-10, -2, 10, -2, 1.4),
      line(-10, 5, 10, 5, 1.4),
      line(-10, 10, 10, 10, 1.4),
    ],
    keywords: ['sèche-serviettes', 'salle de bain', 'radiateur'],
  }),
  chauf({
    id: 'plancher-chauffant',
    name: 'Plancher chauffant',
    subCategory: 'Émetteurs',
    shapes: [rect(-16, -16, 32, 32, 'none', 1.4), p('M-11 -11H11V-5H-11V1H11V7H-11V12', 'none', 1.6)],
    keywords: ['plancher', 'chauffant', 'sol'],
    snapToWall: false,
  }),
  chauf({
    id: 'chauffage-thermostat',
    name: 'Thermostat',
    subCategory: 'Régulation',
    shapes: wallBox('T°'),
    keywords: ['thermostat', 'régulation', 'fil pilote'],
    defaultSize: 32,
  }),
  chauf({
    id: 'pompe-a-chaleur',
    name: 'Pompe à chaleur',
    subCategory: 'Générateurs',
    shapes: [rect(-17, -13, 34, 26, 'white'), c(-7, 0, 8), ...fanBlades(-7, 0, 6), t('PAC', 9, 0, 5.5)],
    keywords: ['pac', 'pompe à chaleur', 'air eau'],
    snapToWall: false,
  }),
  chauf({
    id: 'climatisation',
    name: 'Climatisation',
    subCategory: 'Générateurs',
    shapes: [
      rect(-17, WALL_BACK, 34, 13, 'white'),
      line(-13, -6, 13, -6, 1.2),
      line(-8, 1, -8, 8, 1.4),
      line(0, 1, 0, 10, 1.4),
      line(8, 1, 8, 8, 1.4),
      t('CLIM', 0, 15.5, 5.5),
    ],
    keywords: ['clim', 'climatisation', 'split', 'climatiseur'],
  }),
];

/* ------------------------------------------------------------------ */
/* CUISINE / ÉLECTROMÉNAGER                                            */
/* ------------------------------------------------------------------ */
const elm = categoryFactory('electromenager', { snapToWall: true, defaultSize: 40 });
const hob = [c(-6, -9, 4, 'none', 1.4), c(6, -9, 4, 'none', 1.4), c(-6, 2, 4, 'none', 1.4), c(6, 2, 4, 'none', 1.4)];
const ELECTROMENAGER: ElectricalSymbolDefinition[] = [
  elm({
    id: 'four',
    name: 'Four',
    subCategory: 'Cuisson',
    shapes: applianceBox('FOUR', [line(-15, -11, 15, -11, 1.2), rect(-9, -8, 18, 11, 'none', 1.4)], 8.5),
    keywords: ['four', 'cuisson', 'encastrable'],
  }),
  elm({
    id: 'plaque-cuisson',
    name: 'Plaque cuisson',
    subCategory: 'Cuisson',
    shapes: [rect(-15, WALL_BACK, 30, 30, 'white'), ...hob, t('PL', 0, 10, 6)],
    keywords: ['plaque', 'cuisson', 'vitrocéramique', 'cuisinière'],
  }),
  elm({
    id: 'plaque-induction',
    name: 'Plaque induction',
    subCategory: 'Cuisson',
    shapes: [
      rect(-15, WALL_BACK, 30, 30, 'white'),
      ...hob,
      c(-6, -9, 1.6, 'color', 0.8),
      c(6, -9, 1.6, 'color', 0.8),
      c(-6, 2, 1.6, 'color', 0.8),
      c(6, 2, 1.6, 'color', 0.8),
      t('IND', 0, 10, 6),
    ],
    keywords: ['induction', 'plaque', 'cuisson', '32a'],
  }),
  elm({
    id: 'hotte',
    name: 'Hotte',
    subCategory: 'Cuisson',
    shapes: [p(`M-6 ${WALL_BACK}H6V-8L15 4H-15L-6 -8Z`, 'white'), t('HOTTE', 0, 10, 5.5)],
    keywords: ['hotte', 'aspirante', 'extraction'],
  }),
  elm({
    id: 'lave-vaisselle',
    name: 'Lave-vaisselle',
    subCategory: 'Lavage',
    shapes: applianceBox('LV', [line(-15, -11, 15, -11, 1.2), c(0, -2, 5, 'none', 1.2)], 9.5),
    keywords: ['lave-vaisselle', 'lv', 'vaisselle'],
  }),
  elm({
    id: 'refrigerateur',
    name: 'Réfrigérateur',
    subCategory: 'Froid',
    shapes: applianceBox('FRIGO', [line(-15, -5, 15, -5, 1.2), line(10, -13, 10, -8, 1.4), line(10, -2, 10, 3, 1.4)], 9.5),
    keywords: ['réfrigérateur', 'frigo', 'froid'],
  }),
  elm({
    id: 'congelateur',
    name: 'Congélateur',
    subCategory: 'Froid',
    shapes: applianceBox('CONG', [line(0, -13, 0, 1, 1.2), line(-6, -9, 6, -3, 1.2), line(-6, -3, 6, -9, 1.2)], 9.5),
    keywords: ['congélateur', 'froid', 'coffre'],
  }),
  elm({
    id: 'micro-ondes',
    name: 'Micro-ondes',
    subCategory: 'Cuisson',
    shapes: applianceBox('MO', [rect(-11, -12, 14, 12, 'none', 1.2), dot(8, -9, 1.2), dot(8, -5, 1.2), dot(8, -1, 1.2)], 8),
    keywords: ['micro-ondes', 'mo'],
  }),
  elm({
    id: 'machine-cafe',
    name: 'Machine à café',
    subCategory: 'Petit électroménager',
    shapes: applianceBox('CAFÉ', [p('M-7 -10H5V-2A6 6 0 0 1 -7 -2Z', 'none', 1.4), p('M5 -8A3 3 0 0 1 5 -3', 'none', 1.4)], 8.5),
    keywords: ['café', 'expresso', 'machine'],
  }),
  elm({
    id: 'cave-a-vin',
    name: 'Cave à vin',
    subCategory: 'Froid',
    shapes: applianceBox('CAVE', [p('M-2 -13H2V-10L4 -7V2H-4V-7L-2 -10Z', 'none', 1.3)], 9.5),
    keywords: ['cave', 'vin', 'froid'],
  }),
];

/* ------------------------------------------------------------------ */
/* BUANDERIE                                                           */
/* ------------------------------------------------------------------ */
const bua = categoryFactory('buanderie', { snapToWall: true, defaultSize: 40 });
const BUANDERIE: ElectricalSymbolDefinition[] = [
  bua({
    id: 'lave-linge',
    name: 'Lave-linge',
    subCategory: 'Lavage',
    shapes: applianceBox('LL', [c(0, -3, 7, 'none', 1.4), line(-15, -12, 15, -12, 1.2)], 9.5),
    keywords: ['lave-linge', 'll', 'machine à laver'],
  }),
  bua({
    id: 'seche-linge',
    name: 'Sèche-linge',
    subCategory: 'Lavage',
    shapes: applianceBox('SL', [c(0, -3, 7, 'none', 1.4), p('M-4 -3Q-2 -6 0 -3T4 -3', 'none', 1.2), line(-15, -12, 15, -12, 1.2)], 9.5),
    keywords: ['sèche-linge', 'sl', 'séchoir'],
  }),
  bua({
    id: 'chauffe-eau',
    name: 'Chauffe-eau',
    subCategory: 'Eau chaude',
    shapes: [p(`M-10 ${WALL_BACK}H10V10A10 6 0 0 1 -10 10Z`, 'white'), filled('M1 -12L-4 -3H0L-2 5L4 -5H0Z'), t('CE', 0, 11, 6)],
    keywords: ['chauffe-eau', 'cumulus', 'ballon', 'ecs'],
  }),
  bua({
    id: 'ballon-thermodynamique',
    name: 'Ballon thermodynamique',
    subCategory: 'Eau chaude',
    shapes: [p(`M-10 ${WALL_BACK}H10V10A10 6 0 0 1 -10 10Z`, 'white'), ...fanBlades(0, -7, 6), t('BT', 0, 7, 7)],
    keywords: ['thermodynamique', 'ballon', 'ecs', 'pac'],
  }),
];

/* ------------------------------------------------------------------ */
/* SÉCURITÉ                                                            */
/* ------------------------------------------------------------------ */
const sec = categoryFactory('securite', { snapToWall: false, defaultSize: 32 });
const SECURITE: ElectricalSymbolDefinition[] = [
  sec({
    id: 'detecteur-fumee',
    name: 'Détecteur fumée',
    subCategory: 'Détection',
    shapes: circleLabel('DAAF', 13),
    keywords: ['daaf', 'fumée', 'incendie', 'détecteur'],
  }),
  sec({ id: 'detecteur-co', name: 'Détecteur CO', subCategory: 'Détection', shapes: circleLabel('CO', 13), keywords: ['co', 'monoxyde', 'détecteur'] }),
  sec({
    id: 'detecteur-mouvement',
    name: 'Détecteur mouvement',
    subCategory: 'Détection',
    shapes: motionGlyph(),
    keywords: ['mouvement', 'pir', 'détecteur'],
    snapToWall: true,
  }),
  sec({
    id: 'detecteur-presence',
    name: 'Détecteur présence',
    subCategory: 'Détection',
    shapes: [c(0, 0, 12, 'white'), c(0, 0, 7, 'none', 1.2), c(0, 0, 2.5, 'color', 1), t('P', 0, -17.5, 6)],
    keywords: ['présence', 'détecteur', 'plafond'],
  }),
  sec({
    id: 'detecteur-ouverture',
    name: 'Détecteur ouverture',
    subCategory: 'Détection',
    shapes: [rect(-13, WALL_BACK, 11, 7, 'white'), rect(2, WALL_BACK, 11, 7, 'white'), p('M-7 -5Q0 2 7 -5', 'none', 1.4), t('OUV', 0, 8, 6)],
    keywords: ['ouverture', 'contact', 'magnétique', 'porte'],
    snapToWall: true,
  }),
  sec({ id: 'camera', name: 'Caméra', subCategory: 'Vidéo', shapes: cameraGlyph(), keywords: ['caméra', 'vidéo', 'surveillance'], snapToWall: true }),
  sec({
    id: 'sirene',
    name: 'Sirène',
    subCategory: 'Alarme',
    shapes: [
      rect(-4, WALL_BACK, 8, 8, 'white'),
      p(`M-4 -12L-12 4H12L4 -12Z`, 'white'),
      line(-15, 8, -18, 13, 1.4),
      line(0, 8, 0, 14, 1.4),
      line(15, 8, 18, 13, 1.4),
    ],
    keywords: ['sirène', 'alarme'],
    snapToWall: true,
  }),
  sec({ id: 'alarme', name: 'Alarme', subCategory: 'Alarme', shapes: bellGlyph(0, -2), keywords: ['alarme', 'cloche'], snapToWall: true }),
  sec({
    id: 'centrale-alarme',
    name: 'Centrale alarme',
    subCategory: 'Alarme',
    shapes: [
      rect(-14, WALL_BACK, 28, 26, 'white'),
      dot(-6, -9, 1.5),
      dot(0, -9, 1.5),
      dot(6, -9, 1.5),
      dot(-6, -4, 1.5),
      dot(0, -4, 1.5),
      dot(6, -4, 1.5),
      t('ALARME', 0, 4, 5),
    ],
    keywords: ['centrale', 'alarme', 'clavier'],
    snapToWall: true,
  }),
  sec({
    id: 'interphone',
    name: 'Interphone',
    subCategory: 'Accès',
    shapes: [rect(-10, WALL_BACK, 20, 28, 'white'), line(-5, -11, 5, -11, 1.2), line(-5, -8, 5, -8, 1.2), line(-5, -5, 5, -5, 1.2), c(0, 4, 3, 'none', 1.4)],
    keywords: ['interphone', 'audio', 'portier'],
    snapToWall: true,
  }),
  sec({
    id: 'visiophone',
    name: 'Visiophone',
    subCategory: 'Accès',
    shapes: [rect(-11, WALL_BACK, 22, 28, 'white'), rect(-7, -12, 14, 10, 'none', 1.4), c(0, 5, 2.5, 'none', 1.2)],
    keywords: ['visiophone', 'vidéo', 'portier', 'écran'],
    snapToWall: true,
  }),
  sec({
    id: 'sonnette',
    name: 'Sonnette',
    subCategory: 'Accès',
    shapes: [p(`M-9 ${WALL_BACK}A9 9 0 0 0 9 ${WALL_BACK}Z`, 'white'), line(0, -7, 0, 2), line(-6, 2, 6, 2), t('SON', 0, 10, 6)],
    keywords: ['sonnette', 'carillon', 'bouton'],
    snapToWall: true,
  }),
];

/* ------------------------------------------------------------------ */
/* DOMOTIQUE                                                           */
/* ------------------------------------------------------------------ */
const dom = categoryFactory('domotique', { snapToWall: false, defaultSize: 32 });
const DOMOTIQUE: ElectricalSymbolDefinition[] = [
  dom({
    id: 'passerelle-domotique',
    name: 'Passerelle domotique',
    subCategory: 'Centrale',
    shapes: [rect(-15, -9, 30, 20, 'white'), ...wifi(0, -1, 0.9), t('BOX', 0, 15, 6)],
    keywords: ['passerelle', 'box', 'hub', 'domotique', 'zigbee'],
  }),
  dom({
    id: 'module-connecte',
    name: 'Module connecté',
    subCategory: 'Modules',
    shapes: [rect(-10, -10, 20, 20, 'white'), ...wifi(0, -1, 0.8)],
    keywords: ['module', 'connecté', 'micromodule'],
  }),
  dom({
    id: 'relais-connecte',
    name: 'Relais connecté',
    subCategory: 'Modules',
    shapes: [rect(-12, -12, 24, 24, 'white'), t('R', -4, 2, 9), ...wifi(6, -4, 0.55)],
    keywords: ['relais', 'connecté', 'contact sec'],
  }),
  dom({
    id: 'dom-inter-connecte',
    name: 'Inter connecté',
    subCategory: 'Commandes',
    shapes: [...switchGlyph(1), ...wifi(-9, 5, 0.8)],
    keywords: ['inter', 'connecté', 'sans fil'],
    snapToWall: true,
    role: 'switch',
  }),
  dom({
    id: 'prise-connectee',
    name: 'Prise connectée',
    subCategory: 'Commandes',
    shapes: [...socket(), ...wifi(0, 10, 0.6)],
    keywords: ['prise', 'connectée', 'smart plug'],
    snapToWall: true,
    role: 'socket',
  }),
  dom({
    id: 'capteur-temperature',
    name: 'Capteur température',
    subCategory: 'Capteurs',
    shapes: circleLabel('T°', 12),
    keywords: ['capteur', 'température', 'sonde'],
    role: 'sensor',
  }),
  dom({
    id: 'capteur-luminosite',
    name: 'Capteur luminosité',
    subCategory: 'Capteurs',
    shapes: circleLabel('LUX', 12),
    keywords: ['capteur', 'luminosité', 'lux'],
    role: 'sensor',
  }),
  dom({
    id: 'capteur-mouvement',
    name: 'Capteur mouvement',
    subCategory: 'Capteurs',
    shapes: [...motionGlyph(), ...wifi(12, -12, 0.5)],
    keywords: ['capteur', 'mouvement', 'connecté'],
    snapToWall: true,
    role: 'sensor',
  }),
  dom({
    id: 'commande-centralisee',
    name: 'Commande centralisée',
    subCategory: 'Commandes',
    shapes: [
      rect(-13, WALL_BACK, 26, 26, 'white'),
      rect(-9, -12, 7, 7, 'color', 1),
      rect(2, -12, 7, 7, 'color', 1),
      rect(-9, -1, 7, 7, 'color', 1),
      rect(2, -1, 7, 7, 'color', 1),
    ],
    keywords: ['centralisée', 'générale', 'volets'],
    snapToWall: true,
    role: 'switch',
  }),
  dom({
    id: 'commande-scenario',
    name: 'Commande scénario',
    subCategory: 'Commandes',
    shapes: [rect(-13, WALL_BACK, 26, 26, 'white'), filled('M0 -13L2.6 -7.4L8.6 -7L4 -3L5.4 3L0 -0.2L-5.4 3L-4 -3L-8.6 -7L-2.6 -7.4Z'), t('SC', 0, 7, 6)],
    keywords: ['scénario', 'ambiance', 'scène'],
    snapToWall: true,
    role: 'switch',
  }),
];

/* ------------------------------------------------------------------ */
/* PORTAIL / EXTÉRIEUR                                                 */
/* ------------------------------------------------------------------ */
const ext = categoryFactory('exterieur', { snapToWall: false, defaultSize: 40 });
const EXTERIEUR: ElectricalSymbolDefinition[] = [
  ext({
    id: 'portail',
    name: 'Portail',
    subCategory: 'Portail',
    shapes: [
      line(-18, 4, -16, 4, 3),
      line(16, 4, 18, 4, 3),
      p('M-16 4L-2 -8', 'none', 2),
      p('M16 4L2 -8', 'none', 2),
      p('M-16 4A18 18 0 0 1 -2 -10', 'none', 1),
      p('M16 4A18 18 0 0 0 2 -10', 'none', 1),
    ],
    keywords: ['portail', 'battant', 'entrée'],
  }),
  ext({
    id: 'moteur-portail',
    name: 'Moteur portail',
    subCategory: 'Portail',
    shapes: [c(0, -3, 10, 'white'), t('M', 0, -3, 10), line(-16, 12, 16, 12, 2), t('PORTAIL', 0, 17.5, 4.5)],
    keywords: ['moteur', 'portail', 'motorisation', 'automatisme'],
  }),
  ext({
    id: 'porte-garage',
    name: 'Porte garage',
    subCategory: 'Garage',
    shapes: [rect(-16, -12, 32, 24, 'white'), line(-16, -6, 16, -6, 1.2), line(-16, 0, 16, 0, 1.2), line(-16, 6, 16, 6, 1.2)],
    keywords: ['porte', 'garage', 'sectionnelle'],
  }),
  ext({
    id: 'motorisation-garage',
    name: 'Motorisation garage',
    subCategory: 'Garage',
    shapes: [rect(-16, -6, 32, 18, 'white'), line(-16, 0, 16, 0, 1.2), line(-16, 6, 16, 6, 1.2), c(0, -11, 7, 'white'), t('M', 0, -11, 7.5)],
    keywords: ['motorisation', 'garage', 'moteur'],
  }),
  ext({
    id: 'digicode',
    name: 'Digicode',
    subCategory: 'Accès',
    shapes: [rect(-11, WALL_BACK, 22, 30, 'white'), ...[-5, 0, 5].flatMap((x) => [dot(x, -10, 1.6), dot(x, -4, 1.6), dot(x, 2, 1.6)]), dot(0, 8, 1.6)],
    keywords: ['digicode', 'clavier', 'code'],
    snapToWall: true,
    defaultSize: 32,
  }),
  ext({
    id: 'lecteur-badge',
    name: 'Lecteur badge',
    subCategory: 'Accès',
    shapes: [
      rect(-10, WALL_BACK, 20, 26, 'white'),
      p('M-4 -6Q0 -10 4 -6', 'none', 1.4),
      p('M-6.5 -3Q0 -10 6.5 -3', 'none', 1.4),
      dot(0, -3, 1.8),
      t('BADGE', 0, 5, 4.8),
    ],
    keywords: ['badge', 'rfid', 'vigik', 'lecteur'],
    snapToWall: true,
    defaultSize: 32,
  }),
  ext({
    id: 'sonnette-exterieure',
    name: 'Sonnette extérieure',
    subCategory: 'Accès',
    shapes: [...bellGlyph(0, -4), t('EXT', 0, 14, 6)],
    keywords: ['sonnette', 'extérieure', 'portail'],
    snapToWall: true,
    defaultSize: 32,
  }),
  ext({
    id: 'camera-exterieure',
    name: 'Caméra extérieure',
    subCategory: 'Vidéo',
    shapes: [...cameraGlyph(), t('EXT', 0, 10, 6)],
    keywords: ['caméra', 'extérieure', 'surveillance'],
    snapToWall: true,
    defaultSize: 32,
    role: 'sensor',
  }),
];

/* ------------------------------------------------------------------ */
/* TABLEAU                                                             */
/* ------------------------------------------------------------------ */
const tab = categoryFactory('tableau', { snapToWall: false, defaultSize: 34 });
const TABLEAU: ElectricalSymbolDefinition[] = [
  tab({
    id: 'tableau-electrique',
    name: 'Tableau électrique',
    subCategory: 'Tableau',
    shapes: [rect(-17, -11, 34, 22, 'white'), filled('M-17 11L17 -11V11Z')],
    keywords: ['tableau', 'gtl', 'coffret', 'répartition'],
    snapToWall: true,
    defaultSize: 44,
  }),
  tab({
    id: 'disjoncteur',
    name: 'Disjoncteur',
    subCategory: 'Protection',
    shapes: dinModule('C16', breakerMark(0, -1)),
    keywords: ['disjoncteur', 'protection', 'div', 'c16', 'c20'],
  }),
  tab({
    id: 'disjoncteur-differentiel',
    name: 'Disjoncteur différentiel',
    subCategory: 'Protection',
    shapes: dinModule('DD', [...breakerMark(-2, -1), c(5, -1, 2.5, 'none', 1.2)], 20),
    keywords: ['disjoncteur', 'différentiel', 'dd', 'branchement'],
  }),
  tab({
    id: 'interrupteur-differentiel',
    name: 'Interrupteur différentiel',
    subCategory: 'Protection',
    shapes: dinModule('30mA', [line(0, -7, 0, -3, 1.6), line(0, -3, 3.5, 3, 1.6), line(0, 3, 0, 6, 1.6), c(-4.5, 0, 2.5, 'none', 1.2)], 20),
    keywords: ['id', 'interrupteur', 'différentiel', '30ma', 'type a', 'type ac'],
  }),
  tab({
    id: 'contacteur',
    name: 'Contacteur',
    subCategory: 'Commande',
    shapes: dinModule('KM', [rect(-4, -6, 8, 10, 'none', 1.4)]),
    keywords: ['contacteur', 'km', 'relais'],
  }),
  tab({
    id: 'contacteur-jour-nuit',
    name: 'Contacteur jour/nuit',
    subCategory: 'Commande',
    shapes: dinModule('J/N', [rect(-4, -6, 8, 10, 'none', 1.4), line(-4, 4, 4, -6, 1)]),
    keywords: ['contacteur', 'jour nuit', 'heures creuses', 'hc'],
  }),
  tab({
    id: 'tab-telerupteur',
    name: 'Télérupteur',
    subCategory: 'Commande',
    shapes: dinModule('TL', [rect(-4, -6, 8, 10, 'none', 1.4), line(-2, -1, 2, -1, 1.2)]),
    keywords: ['télérupteur', 'tl', 'modulaire'],
  }),
  tab({
    id: 'parafoudre',
    name: 'Parafoudre',
    subCategory: 'Protection',
    shapes: dinModule('PF', [filled('M1.5 -8L-3 -1H0.5L-1.5 5L3.5 -3H0Z')]),
    keywords: ['parafoudre', 'foudre', 'surtension'],
  }),
  tab({
    id: 'tab-horloge',
    name: 'Horloge',
    subCategory: 'Commande',
    shapes: dinModule('HOR', clockGlyph(0, -1, 5.5)),
    keywords: ['horloge', 'programmateur', 'modulaire'],
  }),
  tab({
    id: 'tab-minuterie',
    name: 'Minuterie',
    subCategory: 'Commande',
    shapes: dinModule('MIN', [c(0, -1, 5.5, 'none', 1.4), line(0, -1, 0, -5, 1.2), line(0, -1, 3, 0, 1.2)]),
    keywords: ['minuterie', 'modulaire', 'escalier'],
  }),
  tab({
    id: 'transformateur',
    name: 'Transformateur',
    subCategory: 'Alimentation',
    shapes: dinModule('TR', [c(0, -3.5, 3.5, 'none', 1.3), c(0, 1.5, 3.5, 'none', 1.3)]),
    keywords: ['transformateur', 'transfo', '12v', 'sonnerie'],
  }),
  tab({
    id: 'alimentation',
    name: 'Alimentation',
    subCategory: 'Alimentation',
    shapes: dinModule('ALIM', [line(-4, -3, 4, -3, 1.4), line(-4, 1, -2, 1, 1.4), line(0, 1, 2, 1, 1.4), line(4, 1, 5, 1, 1.4)]),
    keywords: ['alimentation', 'dc', '24v', '12v'],
  }),
  tab({
    id: 'module-domotique',
    name: 'Module domotique',
    subCategory: 'Commande',
    shapes: dinModule('DOM', wifi(0, -2, 0.55)),
    keywords: ['domotique', 'modulaire', 'passerelle'],
  }),
  tab({
    id: 'bornier',
    name: 'Borne',
    subCategory: 'Raccordement',
    shapes: dinModule('BRN', [c(-3, -3, 2, 'none', 1.2), c(3, -3, 2, 'none', 1.2), c(-3, 2, 2, 'none', 1.2), c(3, 2, 2, 'none', 1.2)]),
    keywords: ['borne', 'bornier', 'répartiteur'],
  }),
  tab({
    id: 'peigne',
    name: 'Peigne',
    subCategory: 'Raccordement',
    shapes: [line(-17, -6, 17, -6, 2.6), ...[-14, -7, 0, 7, 14].map((x) => line(x, -6, x, 6, 1.8))],
    keywords: ['peigne', 'rangée', 'alimentation'],
  }),
  tab({
    id: 'compteur',
    name: 'Compteur',
    subCategory: 'Comptage',
    shapes: [rect(-14, -16, 28, 32, 'white'), rect(-9, -11, 18, 8, 'none', 1.2), t('kWh', 0, 6, 7)],
    keywords: ['compteur', 'linky', 'enedis', 'kwh'],
    snapToWall: true,
  }),
  tab({
    id: 'sous-compteur',
    name: 'Sous-compteur',
    subCategory: 'Comptage',
    shapes: dinModule('kWh', [rect(-5, -6, 10, 6, 'none', 1.2)], 18),
    keywords: ['sous-compteur', 'comptage', 'modulaire'],
  }),
];

/* ------------------------------------------------------------------ */
/* DIVERS                                                              */
/* ------------------------------------------------------------------ */
const div = categoryFactory('divers', { snapToWall: false, defaultSize: 30 });
const DIVERS: ElectricalSymbolDefinition[] = [
  div({
    id: 'boite-derivation',
    name: 'Boîte dérivation',
    subCategory: 'Boîtes',
    shapes: [rect(-10, -10, 20, 20, 'white'), line(-10, -10, 10, 10, 1.4), line(-10, 10, 10, -10, 1.4)],
    keywords: ['boîte', 'dérivation', 'jonction', 'connexion'],
  }),
  div({
    id: 'boite-encastrement',
    name: 'Boîte encastrement',
    subCategory: 'Boîtes',
    shapes: [c(0, 0, 10, 'white'), c(0, 0, 5.5, 'none', 1.4)],
    keywords: ['boîte', 'encastrement', 'placo', 'pot'],
  }),
  div({ id: 'terre', name: 'Terre', subCategory: 'Terre', shapes: earthGlyph(0, -2), keywords: ['terre', 'masse', 'piquet'] }),
  div({
    id: 'liaison-equipotentielle',
    name: 'Liaison équipotentielle',
    subCategory: 'Terre',
    shapes: [...earthGlyph(0, -6), t('LES', 0, 12, 6.5)],
    keywords: ['liaison', 'équipotentielle', 'les', 'sdb'],
  }),
  div({
    id: 'barrette-terre',
    name: 'Barrette terre',
    subCategory: 'Terre',
    shapes: [
      rect(-15, -12, 30, 8, 'white'),
      c(-8, -8, 1.6, 'color', 1),
      c(0, -8, 1.6, 'color', 1),
      c(8, -8, 1.6, 'color', 1),
      ...earthGlyph(0, 8).slice(1),
      line(0, -4, 0, 8),
    ],
    keywords: ['barrette', 'terre', 'coupure'],
  }),
  div({
    id: 'gaine',
    name: 'Gaine',
    subCategory: 'Cheminement',
    shapes: [p('M-18 0Q-13.5 -7 -9 0T0 0T9 0T18 0', 'none', 2.4), t('ICTA', 0, 10, 6)],
    keywords: ['gaine', 'icta', 'fourreau', 'tube'],
  }),
  div({
    id: 'chemin-cable',
    name: 'Chemin câble',
    subCategory: 'Cheminement',
    shapes: [line(-18, -5, 18, -5), line(-18, 5, 18, 5), ...[-12, -4, 4, 12].map((x) => line(x, -5, x, 5, 1.2))],
    keywords: ['chemin', 'câble', 'dalle', 'tablette'],
  }),
  div({
    id: 'goulotte',
    name: 'Goulotte',
    subCategory: 'Cheminement',
    shapes: [rect(-18, -5, 36, 10, 'white'), line(-18, 0, 18, 0, 1)],
    keywords: ['goulotte', 'moulure', 'plinthe'],
    snapToWall: true,
  }),
  div({
    id: 'coffret-communication',
    name: 'Coffret communication',
    subCategory: 'Coffrets',
    shapes: [rect(-15, -15, 30, 30, 'white'), filled('M-15 15L-15 5L-5 15Z'), t('COM', 0, -3, 7), dot(-5, 6, 1.4), dot(0, 6, 1.4), dot(5, 6, 1.4)],
    keywords: ['coffret', 'communication', 'grade', 'baie', 'brassage', 'réseau'],
    snapToWall: true,
    defaultSize: 40,
  }),
];

/** Liste complète des symboles disponibles. */
export const ELECTRICAL_SYMBOLS: ElectricalSymbolDefinition[] = [
  ...PRISES,
  ...RESEAU,
  ...COMMANDES,
  ...ECLAIRAGE,
  ...VENTILATION,
  ...CHAUFFAGE,
  ...ELECTROMENAGER,
  ...BUANDERIE,
  ...SECURITE,
  ...DOMOTIQUE,
  ...EXTERIEUR,
  ...TABLEAU,
  ...DIVERS,
];

const SYMBOL_MAP = new Map(ELECTRICAL_SYMBOLS.map((s) => [s.id, s]));

/** Symbole de repli si un identifiant n'existe plus. */
const UNKNOWN_SYMBOL = categoryFactory('divers', { snapToWall: false, defaultSize: 30 })({
  id: 'inconnu',
  name: 'Symbole inconnu',
  subCategory: 'Divers',
  shapes: [...circleLabel('?', 12)],
});

export function getSymbolDefinition(id: string): ElectricalSymbolDefinition {
  return SYMBOL_MAP.get(id) ?? UNKNOWN_SYMBOL;
}

export function hasSymbol(id: string): boolean {
  return SYMBOL_MAP.has(id);
}

export interface SymbolCategoryInfo {
  id: SymbolCategoryId;
  label: string;
}

export const SYMBOL_CATEGORIES: SymbolCategoryInfo[] = [
  { id: 'prises', label: 'Prises' },
  { id: 'reseau', label: 'Réseau / Communication' },
  { id: 'commandes', label: 'Commandes' },
  { id: 'eclairage', label: 'Éclairage' },
  { id: 'ventilation', label: 'Ventilation' },
  { id: 'chauffage', label: 'Chauffage' },
  { id: 'electromenager', label: 'Cuisine / Électroménager' },
  { id: 'buanderie', label: 'Buanderie' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'domotique', label: 'Domotique' },
  { id: 'exterieur', label: 'Portail / Extérieur' },
  { id: 'tableau', label: 'Tableau' },
  { id: 'divers', label: 'Divers' },
];

export function categoryLabel(id: SymbolCategoryId): string {
  return SYMBOL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Filtres de la bibliothèque (« Autres » regroupe électroménager, buanderie, extérieur, divers). */
export type LibraryFilterId =
  | 'all'
  | 'favorites'
  | 'prises'
  | 'commandes'
  | 'eclairage'
  | 'ventilation'
  | 'chauffage'
  | 'reseau'
  | 'securite'
  | 'domotique'
  | 'tableau'
  | 'autres';

export const LIBRARY_FILTERS: { id: LibraryFilterId; label: string; categories?: SymbolCategoryId[] }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'favorites', label: 'Favoris' },
  { id: 'prises', label: 'Prises', categories: ['prises'] },
  { id: 'commandes', label: 'Commandes', categories: ['commandes'] },
  { id: 'eclairage', label: 'Éclairage', categories: ['eclairage'] },
  { id: 'ventilation', label: 'Ventilation', categories: ['ventilation'] },
  { id: 'chauffage', label: 'Chauffage', categories: ['chauffage'] },
  { id: 'reseau', label: 'Réseau', categories: ['reseau'] },
  { id: 'securite', label: 'Sécurité', categories: ['securite'] },
  { id: 'domotique', label: 'Domotique', categories: ['domotique'] },
  { id: 'tableau', label: 'Tableau', categories: ['tableau'] },
  { id: 'autres', label: 'Autres', categories: ['electromenager', 'buanderie', 'exterieur', 'divers'] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

const SEARCH_INDEX = new Map(
  ELECTRICAL_SYMBOLS.map((s) => [s.id, normalize([s.name, s.subCategory, categoryLabel(s.category), ...s.keywords, s.description].join(' '))]),
);

/** Recherche plein texte (insensible aux accents), triée par pertinence. */
export function searchSymbols(query: string, list: ElectricalSymbolDefinition[] = ELECTRICAL_SYMBOLS): ElectricalSymbolDefinition[] {
  const q = normalize(query);
  if (!q) return list;
  const terms = q.split(' ');
  const scored: { s: ElectricalSymbolDefinition; score: number }[] = [];
  for (const s of list) {
    const hay = SEARCH_INDEX.get(s.id) ?? '';
    if (!terms.every((term) => hay.includes(term))) continue;
    const name = normalize(s.name);
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if (name.includes(q)) score += 20;
    scored.push({ s, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}

/** Symboles proposés dans les raccourcis de la barre mobile. */
export const QUICK_GROUPS = {
  prises: [
    'prise-16a',
    'prise-double-16a',
    'prise-triple',
    'prise-20a',
    'prise-32a',
    'prise-specialisee',
    'prise-usb-ac',
    'prise-rj45',
    'prise-tv',
    'prise-ext-ip44',
  ],
  commandes: [
    'inter-simple',
    'inter-double',
    'va-et-vient',
    'double-va-et-vient',
    'permutateur',
    'bouton-poussoir',
    'variateur',
    'commande-volet',
    'cmd-thermostat',
    'inter-connecte',
  ],
  lumieres: [
    'point-lumineux',
    'dcl',
    'spot',
    'spot-encastre',
    'applique-murale',
    'suspension',
    'bandeau-led',
    'applique-exterieure',
    'projecteur-exterieur',
    'baes',
  ],
} as const;
