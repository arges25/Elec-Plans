/**
 * Configurateur de tableau électrique — types de données.
 *
 * Règle du programme : une référence ou une dimension absente de la base locale
 * vaut `null` et s'affiche « Données techniques non renseignées ». Jamais de
 * valeur approximative présentée comme une donnée fabricant.
 */

export type Brand = 'legrand' | 'schneider' | 'hager';

/** Traçabilité d'une donnée fabricant. */
export interface DataSource {
  /** Ex. « Legrand officiel », « Schneider Electric officiel ». */
  sourceName: string | null;
  sourceUrl: string | null;
  /** Mois de dernière vérification (AAAA-MM). */
  lastVerified: string | null;
}

export interface Dimensions {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export type Mounting = 'surface' | 'flush';

/** Coffret (tableau) d'une gamme. */
export interface EnclosureModel extends DataSource {
  id: string;
  brand: Brand;
  family: string;
  /** Référence commerciale officielle, ou null si non vérifiée. */
  reference: string | null;
  name: string;
  rows: number;
  modulesPerRow: number;
  totalModules: number;
  /** Dimensions extérieures officielles, ou null (« non renseignées »). */
  dimensions: Dimensions | null;
  /** Entraxe entre rails DIN s'il est publié par le fabricant. */
  rowPitchMm: number | null;
  mounting: Mounting | null;
  /** Origine de la donnée : documentation officielle du fabricant. */
  source: 'official';
}

export type DeviceKind =
  | 'rcd'
  | 'breaker'
  | 'teleruptor'
  | 'contactor-hc'
  | 'contactor'
  | 'spd'
  | 'bell'
  | 'bell-transformer'
  | 'timer'
  | 'clock'
  | 'load-shedder'
  | 'relay'
  | 'heating-control'
  | 'energy-meter'
  | 'isolator'
  | 'domotic'
  | 'socket'
  | 'blank'
  | 'reserve';

export type DeviceCategory = 'protection' | 'breakers' | 'control' | 'sockets' | 'accessories';

/** Appareil modulaire du catalogue d'un fabricant. */
export interface DeviceProduct extends DataSource {
  id: string;
  brand: Brand;
  family: string;
  /** Référence officielle éventuelle (null = non renseignée). */
  reference: string | null;
  kind: DeviceKind;
  category: DeviceCategory;
  /** Calibre (A). */
  rating: number | null;
  curve: 'C' | 'D' | null;
  poles: string | null;
  /** Différentiel : sensibilité (mA) et type. */
  sensitivityMa: number | null;
  rcdType: 'AC' | 'A' | 'F' | null;
  /** Largeur en modules DIN (multiples de 0,5). */
  modules: number;
  /** Largeur physique déclarée par le fabricant (mm), si vérifiée. */
  widthMm: number | null;
  shortName: string;
  fullName: string;
  /** Clé d'équivalence entre marques (conversion Legrand ↔ Schneider ↔ Hager). */
  equivalence: string;
  /** Référence et largeur contrôlées sur la documentation officielle. */
  verified: boolean;
}

export interface ManufacturerData {
  brand: Brand;
  name: string;
  families: { id: string; name: string; kind: 'enclosure' | 'devices' }[];
  enclosures: EnclosureModel[];
  devices: DeviceProduct[];
}

export type LabelStyle = 'text' | 'icon' | 'both';

/** Appareil posé sur un rail du tableau. */
export interface PlacedDevice {
  id: string;
  manufacturer: Brand;
  productId: string;
  /** Rangée (0 = haut). */
  row: number;
  /** Premier module occupé (0 = gauche, pas de 0,5). */
  startModule: number;
  moduleWidth: number;
  /** Repère du circuit (au-dessus de l'appareil), texte libre : « 1 », « 14 », « 5a »… */
  circuitRef: string;
  /** Désignation du circuit (sous l'appareil) : « Plaque induction », « PC1 »… */
  label: string;
  /** Nom court facultatif (« PC CUISINE ») ; jamais imposé. */
  shortLabel: string;
  icon: string | null;
  /** Style propre à cette étiquette (sinon style du projet). */
  labelStyle: LabelStyle | null;
  /** Informations complémentaires libres. */
  notes: string;
  /** Étiquette fusionnée avec la zone de l'appareil précédent (même rangée, contigu). */
  mergedWithPrev: boolean;
  /** Appareils partageant la même zone d'étiquette (tenu à jour automatiquement). */
  linkedComponents: string[];
}

export interface PrintSettings {
  /** Largeur d'un module sur l'étiquette imprimée (mm). */
  moduleMm: number;
  /** Hauteur du bandeau d'étiquettes (mm). */
  labelHeightMm: number;
  /** Taille du texte (pt). */
  fontSizePt: number;
  /** Repère imprimé dans le coin de l'étiquette. */
  showRef: boolean;
}

/**
 * Totaux de rangée : aucun calcul n'est fait tant que l'utilisateur n'a pas
 * choisi une règle explicite.
 */
export type TotalsRule = { kind: 'none' } | { kind: 'sum' } | { kind: 'sum-coef'; coef: number };

export type BoardView = 'schema' | 'coffret';

/** Un tableau (principal, garage, étage…) d'un projet. */
export interface Board {
  id: string;
  /** Titre affiché en haut : « TABLEAU PRINCIPAL ». */
  title: string;
  brand: Brand;
  enclosureId: string;
  devices: PlacedDevice[];
  /** Réserve minimale souhaitée (% de modules libres), null = aucune alerte. */
  minFreePercent: number | null;
}

/** Réglages d'affichage communs aux tableaux d'un projet. */
export interface DisplaySettings {
  /** text = Professionnel, both = Visuel, icon = Icône. */
  labelStyle: LabelStyle;
  /** Texte affiché sous l'appareil : désignation ou nom court (si renseigné). */
  labelText: 'long' | 'short';
  showModuleNumbers: boolean;
  showAllBrands: boolean;
  totals: TotalsRule;
  /** Proposer « Quel circuit ? » à la pose d'un disjoncteur. */
  askCircuitOnDrop: boolean;
  view: BoardView;
}

/** Projet enregistré : un ou plusieurs tableaux. */
export interface PanelProject extends DisplaySettings {
  id: string;
  name: string;
  /** Chantier associé (facultatif). */
  projectId: string | null;
  boards: Board[];
  activeBoardId: string;
  print: PrintSettings;
  createdAt: number;
  updatedAt: number;
  version: 2;
}

/**
 * Vue « à plat » du tableau actif (tableau + réglages du projet) : c'est
 * l'objet manipulé par le rendu, le moteur, la nomenclature et l'impression.
 */
export interface BoardDoc extends Board, DisplaySettings {
  projectName: string;
  print: PrintSettings;
}
