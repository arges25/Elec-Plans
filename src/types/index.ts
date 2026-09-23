/**
 * Types métier de MG Elec & Plans.
 * Toutes les coordonnées de plan sont exprimées en « unités plan » (pixels du plan,
 * origine en haut à gauche, axe Y vers le bas).
 */

export type ID = string;

export interface Point {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* Projet / plans                                                      */
/* ------------------------------------------------------------------ */

export type FloorType = 'rdc' | 'etage1' | 'etage2' | 'sous-sol' | 'garage' | 'exterieur' | 'custom';

export interface FloorInfo {
  planId: ID;
  name: string;
  type: FloorType;
}

export interface ProjectStats {
  symbols: number;
  sockets: number;
  lights: number;
  switches: number;
  connections: number;
}

export interface Project {
  id: ID;
  name: string;
  clientName: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  notes: string;
  /** Date du chantier (AAAA-MM-JJ). */
  date: string;
  floors: FloorInfo[];
  createdAt: number;
  updatedAt: number;
  stats?: ProjectStats;
  isDemo?: boolean;
}

export type PlanSource = 'photo' | 'scan' | 'image' | 'pdf' | 'blank' | 'sketch';

export interface Wall {
  id: ID;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

export interface Door {
  id: ID;
  wallId: ID;
  /** Position du centre de l'ouverture le long du mur (0 → 1). */
  t: number;
  width: number;
  /** Sens d'ouverture (côté du battant). */
  flip: boolean;
  /** Charnière à gauche ou à droite. */
  hingeEnd: boolean;
}

export interface Window {
  id: ID;
  wallId: ID;
  t: number;
  width: number;
}

export interface Room {
  id: ID;
  name: string;
  x: number;
  y: number;
}

export type AnnotationKind = 'text' | 'arrow' | 'circle' | 'rect' | 'pen';

export interface Annotation {
  id: ID;
  kind: AnnotationKind;
  /** Pour texte : position. Pour cercle/rect : coin haut-gauche. */
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Pour flèche / crayon : liste de points à plat [x1, y1, x2, y2, ...]. */
  points?: number[];
  text?: string;
  fontSize?: number;
  color: string;
  strokeWidth: number;
}

export interface Measure {
  id: ID;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlanScale {
  /** Nombre d'unités plan pour un mètre réel. */
  pixelsPerMeter: number;
  /** Référence utilisée pour définir l'échelle. */
  reference?: { x1: number; y1: number; x2: number; y2: number; meters: number };
}

export interface PlanVectorData {
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  rooms: Room[];
  annotations: Annotation[];
  measures: Measure[];
}

export type LayerId = 'original' | 'reconstructed' | 'symbols' | 'connections' | 'annotations' | 'measures';

export interface LayerState {
  id: LayerId;
  visible: boolean;
  locked: boolean;
}

export interface Plan {
  id: ID;
  projectId: ID;
  name: string;
  floorType: FloorType;
  order: number;
  source: PlanSource;
  /** Image importée (dataURL compressée). */
  originalImage?: string;
  /** Image redressée / améliorée (dataURL). */
  processedImage?: string;
  backgroundOpacity: number;
  vectorData: PlanVectorData;
  width: number;
  height: number;
  scale?: PlanScale;
  layers: LayerState[];
  /** Indique que le plan vectoriel provient d'une reconstruction automatique. */
  reconstructed?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Symboles électriques                                                */
/* ------------------------------------------------------------------ */

export type SymbolCategoryId =
  | 'prises'
  | 'reseau'
  | 'commandes'
  | 'eclairage'
  | 'ventilation'
  | 'chauffage'
  | 'electromenager'
  | 'buanderie'
  | 'securite'
  | 'domotique'
  | 'exterieur'
  | 'tableau'
  | 'divers';

/** Remplissage d'une primitive : couleur du symbole, blanc, ou aucune. */
export type PrimitiveFill = 'none' | 'color' | 'white';

/**
 * Primitive de dessin d'un symbole dans une boîte de 40 × 40 unités centrée sur (0, 0).
 * Le côté « mur » du symbole est en haut (y négatif).
 */
export type SymbolPrimitive =
  | { k: 'path'; d: string; fill?: PrimitiveFill; stroke?: boolean; sw?: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: PrimitiveFill; stroke?: boolean; sw?: number }
  | { k: 'text'; x: number; y: number; text: string; size: number; bold?: boolean; fill?: 'color' | 'white' };

export interface ElectricalSymbolDefinition {
  id: string;
  name: string;
  category: SymbolCategoryId;
  subCategory: string;
  /** Représentation SVG autonome (générée depuis les primitives). */
  svg: string;
  shapes: SymbolPrimitive[];
  color: string;
  /** Rotation par défaut (degrés). */
  rotation: number;
  /** Taille par défaut sur le plan (unités plan). */
  defaultSize: number;
  keywords: string[];
  favorite: boolean;
  description: string;
  /** S'aimante aux murs (prises, commandes, appliques…). */
  snapToWall: boolean;
  /** Rôle logique utilisé pour les statistiques et les liaisons. */
  role: SymbolRole;
  /** Pictogramme court utilisé dans la légende (texte). */
  legendGlyph?: string;
}

export type SymbolRole = 'socket' | 'network' | 'switch' | 'light' | 'appliance' | 'sensor' | 'panel' | 'other';

export interface PlacedSymbolProperties {
  label?: string;
  room?: string;
  circuitId?: ID;
  circuitName?: string;
  circuitNumber?: string;
  breaker?: string;
  cableSection?: string;
  comment?: string;
  color?: string;
  heightCm?: number;
}

export interface PlacedSymbol {
  id: ID;
  projectId: ID;
  planId: ID;
  symbolType: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  properties: PlacedSymbolProperties;
}

export type ConnectionType = 'command' | 'circuit' | 'information';
export type DashStyle = 'dash' | 'dot' | 'long' | 'solid';

export interface ElectricalConnection {
  id: ID;
  projectId: ID;
  planId: ID;
  sourceId: ID;
  targetId: ID;
  type: ConnectionType;
  color: string;
  width: number;
  dash: DashStyle;
  /** Courbure de la liaison (-1 → 1). */
  curvature: number;
  /** Numéro de groupe de commande (« Commande 1 »). */
  group?: number;
  showLabel?: boolean;
}

/* ------------------------------------------------------------------ */
/* Tableau électrique / étiquettes                                     */
/* ------------------------------------------------------------------ */

export type CircuitKind = 'circuit' | 'differential' | 'main' | 'spare' | 'other';

export interface ElectricalCircuit {
  id: ID;
  panelId: ID;
  rowId: ID;
  order: number;
  number: string;
  name: string;
  kind: CircuitKind;
  /** Largeur en modules (1 module = 1 pas). */
  modules: number;
  protection: string;
  cableSection: string;
  /** Identifiant du pictogramme (symbole) utilisé sur l'étiquette. */
  icon?: string;
}

export interface PanelRow {
  id: ID;
  name: string;
}

export interface ElectricalPanel {
  id: ID;
  /** Projet associé (null = tableau indépendant). */
  projectId: ID | null;
  name: string;
  templateId: string;
  rows: PanelRow[];
  createdAt: number;
  updatedAt: number;
}

/** Personnalisation d'une étiquette (sinon déduite du circuit). */
export interface Label {
  id: ID;
  panelId: ID;
  circuitId: ID;
  text?: string;
  icon?: string | null;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface PanelTemplate {
  id: string;
  name: string;
  brand: string;
  modulesPerRow: number;
  modulePitchMm: number;
  rowWidthMm: number;
  labelHeightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  /** Espacement vertical entre deux bandes imprimées. */
  spacingMm: number;
  fontSizePt: number;
  fontFamily: string;
  borderWidthMm: number;
  showIcon: boolean;
  showNumber: boolean;
  textAlign: TextAlign;
  maxLines: 1 | 2;
  builtIn: boolean;
  /** Note affichée (ex. hauteur à vérifier). */
  note?: string;
  updatedAt?: number;
}

/* ------------------------------------------------------------------ */
/* Impression                                                          */
/* ------------------------------------------------------------------ */

export interface PrintCalibration {
  scaleX: number;
  scaleY: number;
  offsetXMm: number;
  offsetYMm: number;
  measuredXMm?: number;
  measuredYMm?: number;
  calibratedAt?: number;
}

export type PrinterKind = 'system' | 'pdf' | 'bluetooth';

export interface PrinterProfile {
  id: ID;
  name: string;
  kind: PrinterKind;
  calibration: PrintCalibration;
  bluetooth?: {
    profileId: string;
    deviceName?: string;
    deviceId?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export type BluetoothProtocol = 'escpos' | 'proprietary' | 'thermal-raw';

export interface BluetoothPrinterProfile {
  id: string;
  name: string;
  serviceUuid: string;
  characteristicUuid: string;
  protocol: BluetoothProtocol;
  paperWidthMm: number;
  dpi: number;
  /** Taille maximale d'un paquet BLE. */
  chunkSize: number;
  experimental: boolean;
  supported: boolean;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  id: 'app';
  snapEnabled: boolean;
  snapDistance: number;
  gridEnabled: boolean;
  gridSize: number;
  showGuides: boolean;
  commandColor: string;
  circuitColor: string;
  informationColor: string;
  lineWidth: number;
  defaultSymbolScale: number;
  repeatMode: boolean;
  vibration: boolean;
  showCommandNumbers: boolean;
  favorites: string[];
  recentSymbols: string[];
  defaultTemplateId: string;
  defaultPrinterProfileId?: string;
  onboardingDone: boolean;
  installHintDismissed: boolean;
  demoOffered: boolean;
  /** Pixels CSS par millimètre physique (calibration écran facultative). */
  screenPxPerMm?: number;
  remoteReconstructionEnabled: boolean;
  remoteReconstructionEndpoint?: string;
}

/* ------------------------------------------------------------------ */
/* Import / export                                                     */
/* ------------------------------------------------------------------ */

export interface ProjectBundle {
  format: 'mgeplan';
  version: 1;
  app: 'MG Elec & Plans';
  exportedAt: string;
  project: Project;
  plans: Plan[];
  symbols: PlacedSymbol[];
  connections: ElectricalConnection[];
  panels: ElectricalPanel[];
  circuits: ElectricalCircuit[];
  labels: Label[];
  settings?: Partial<Pick<AppSettings, 'favorites' | 'commandColor' | 'circuitColor' | 'informationColor'>>;
}

/** Alias explicite pour éviter la confusion avec l'objet global `window`. */
export type WindowOpening = Window;

/** Document éditable d'un plan (tout ce qui entre dans l'historique annuler / rétablir). */
export interface PlanDocument extends PlanVectorData {
  scale?: PlanScale;
  symbols: PlacedSymbol[];
  connections: ElectricalConnection[];
}
