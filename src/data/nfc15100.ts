/**
 * RÈGLES DE CALCUL DU TABLEAU — NF C 15-100 (logement)
 * ======================================================
 * Toutes les valeurs utilisées par la page « Récapitulatif / Calcul du tableau »
 * sont réunies ici : modifiez-les pour suivre une évolution de la norme ou vos
 * habitudes de chantier (aucune autre modification de code n'est nécessaire).
 *
 * Vérification indicative : elle ne remplace ni le texte de la norme ni l'avis
 * d'un professionnel.
 */

/** Circuit de prises de courant : section, calibre maximal du disjoncteur, nombre maximal de points. */
export interface SocketCircuitRule {
  /** Section des conducteurs (mm²). */
  section: number;
  /** Calibre maximal du disjoncteur (A). */
  breakerA: number;
  /** Nombre maximal de prises (points d'utilisation). */
  maxPoints: number;
}

/** Circuit spécialisé : 1 appareil par circuit, avec sa section et sa protection. */
export interface DedicatedCircuitRule {
  id: string;
  /** Nom proposé pour le circuit (« Lave-linge »). */
  label: string;
  /** Section minimale (mm²). */
  section: number;
  /** Calibre maximal du disjoncteur (A). */
  breakerA: number;
  /** Symboles du plan qui correspondent à cet appareil. */
  symbolTypes: string[];
  /** Mots reconnus dans le nom du circuit ou le nom affiché du symbole (sans accents). */
  keywords: string[];
  /** Interrupteur différentiel de type A conseillé pour ce circuit. */
  rcdTypeA?: boolean;
  /** Contrôler la section et le calibre (false : dimensionnement selon la puissance de l'appareil). */
  verifySizing?: boolean;
}

export interface Nfc15100Rules {
  /** Orange (« proche de la limite ») à partir de cette fraction du maximum. */
  nearLimitRatio: number;
  /** Circuits de prises, du plus courant au moins courant : le premier sert aux nouveaux circuits. */
  sockets: SocketCircuitRule[];
  /** Circuit d'éclairage : section, calibre maximal, nombre maximal de points d'utilisation. */
  lighting: SocketCircuitRule;
  /**
   * Points comptés pour une prise multiple installée dans un même boîtier
   * (double, triple, quadruple). Mettre 2, 3… pour compter chaque socle.
   */
  multiSocketPoints: number;
  /** Symboles comptés comme « prise multiple ». */
  multiSocketTypes: string[];
  /** Circuits spécialisés (1 circuit dédié par appareil). */
  dedicated: DedicatedCircuitRule[];
  /** Circuit spécialisé générique : prise 20 A / spécialisée dont l'appareil n'est pas précisé. */
  dedicatedFallback: DedicatedCircuitRule;
  /** Interrupteurs différentiels 30 mA. */
  rcd: {
    /** Nombre maximal de circuits en aval d'un interrupteur différentiel. */
    maxCircuits: number;
    /** Désignation proposée dans la liste du matériel. */
    rating: string;
    /** Type par défaut pour les circuits sans exigence particulière. */
    defaultType: 'AC' | 'A';
  };
  /** Réserve de place libre à prévoir dans le coffret (%). */
  reservePercent: number;
  /** Modules par rangée du coffret (pour le nombre de rangées conseillé). */
  modulesPerRow: number;
}

export const NFC15100_RULES: Nfc15100Rules = {
  nearLimitRatio: 0.8,
  sockets: [
    { section: 2.5, breakerA: 20, maxPoints: 12 },
    { section: 1.5, breakerA: 16, maxPoints: 8 },
  ],
  lighting: { section: 1.5, breakerA: 16, maxPoints: 8 },
  multiSocketPoints: 1,
  multiSocketTypes: ['prise-double-16a', 'prise-triple', 'prise-quadruple'],
  dedicated: [
    {
      id: 'plaque',
      label: 'Plaque de cuisson',
      section: 6,
      breakerA: 32,
      symbolTypes: ['plaque-cuisson', 'plaque-induction', 'prise-32a'],
      keywords: ['plaque', 'cuisson', 'induction', 'cuisiniere'],
      rcdTypeA: true,
    },
    { id: 'four', label: 'Four', section: 2.5, breakerA: 20, symbolTypes: ['four'], keywords: ['four'] },
    {
      id: 'lave-linge',
      label: 'Lave-linge',
      section: 2.5,
      breakerA: 20,
      symbolTypes: ['lave-linge'],
      keywords: ['lave-linge', 'lave linge', 'machine a laver'],
      rcdTypeA: true,
    },
    { id: 'seche-linge', label: 'Sèche-linge', section: 2.5, breakerA: 20, symbolTypes: ['seche-linge'], keywords: ['seche-linge', 'seche linge'] },
    {
      id: 'lave-vaisselle',
      label: 'Lave-vaisselle',
      section: 2.5,
      breakerA: 20,
      symbolTypes: ['lave-vaisselle'],
      keywords: ['lave-vaisselle', 'lave vaisselle'],
    },
    { id: 'congelateur', label: 'Congélateur', section: 2.5, breakerA: 20, symbolTypes: ['congelateur'], keywords: ['congelateur'] },
    {
      id: 'chauffe-eau',
      label: 'Chauffe-eau',
      section: 2.5,
      breakerA: 20,
      symbolTypes: ['chauffe-eau', 'ballon-thermodynamique'],
      keywords: ['chauffe-eau', 'chauffe eau', 'cumulus', 'ballon'],
    },
    { id: 'vmc', label: 'VMC', section: 1.5, breakerA: 2, symbolTypes: ['vmc-simple-flux', 'vmc-double-flux'], keywords: ['vmc'] },
    {
      id: 've',
      label: 'Recharge véhicule électrique',
      section: 2.5,
      breakerA: 20,
      symbolTypes: ['borne-recharge-ve'],
      keywords: ['vehicule', 'borne', 'recharge', 'irve'],
      rcdTypeA: true,
      verifySizing: false,
    },
  ],
  dedicatedFallback: {
    id: 'specialise',
    label: 'Prise spécialisée',
    section: 2.5,
    breakerA: 20,
    symbolTypes: ['prise-20a', 'prise-specialisee'],
    keywords: [],
  },
  rcd: { maxCircuits: 8, rating: '40 A', defaultType: 'AC' },
  reservePercent: 20,
  modulesPerRow: 13,
};
