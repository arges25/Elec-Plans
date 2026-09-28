import { normalizeText } from '../render/icons';

/**
 * Circuits prédéfinis (création rapide) et abréviations proposées.
 * Rien n'est imposé : l'électricien peut toujours écrire son propre texte.
 */

export interface CircuitPreset {
  id: string;
  name: string;
  /** Nom court proposé (étiquette compacte). */
  short: string;
  icon: string;
}

export const CIRCUIT_PRESETS: CircuitPreset[] = [
  { id: 'four', name: 'Four', short: 'FOUR', icon: 'four' },
  { id: 'plaque', name: 'Plaque de cuisson', short: 'PLAQUE', icon: 'plaque' },
  { id: 'lave-vaisselle', name: 'Lave-vaisselle', short: 'LV', icon: 'lave-vaisselle' },
  { id: 'lave-linge', name: 'Lave-linge', short: 'LL', icon: 'lave-linge' },
  { id: 'seche-linge', name: 'Sèche-linge', short: 'SL', icon: 'seche-linge' },
  { id: 'refrigerateur', name: 'Réfrigérateur', short: 'FRIGO', icon: 'refrigerateur' },
  { id: 'congelateur', name: 'Congélateur', short: 'CONGÉL', icon: 'congelateur' },
  { id: 'hotte', name: 'Hotte', short: 'HOTTE', icon: 'hotte' },
  { id: 'vmc', name: 'VMC', short: 'VMC', icon: 'vmc' },
  { id: 'chauffe-eau', name: 'Chauffe-eau', short: 'CE', icon: 'chauffe-eau' },
  { id: 'eclairage', name: 'Éclairage', short: 'ECL', icon: 'eclairage' },
  { id: 'prises', name: 'Prises', short: 'PC', icon: 'prise' },
  { id: 'prises-cuisine', name: 'Prises cuisine', short: 'PC CUISINE', icon: 'prises-cuisine' },
  { id: 'volets', name: 'Volets roulants', short: 'VR', icon: 'volets' },
  { id: 'chauffage', name: 'Chauffage', short: 'CHAUF', icon: 'radiateur' },
  { id: 'climatisation', name: 'Climatisation', short: 'CLIM', icon: 'climatisation' },
  { id: 'garage', name: 'Garage', short: 'GARAGE', icon: 'garage' },
  { id: 'portail', name: 'Portail', short: 'PORTAIL', icon: 'portail' },
  { id: 'exterieur', name: 'Extérieur', short: 'EXT', icon: 'eclairage-exterieur' },
  { id: 'piscine', name: 'Piscine', short: 'PISCINE', icon: 'piscine' },
  { id: 'borne-ve', name: 'Borne VE', short: 'BORNE VE', icon: 'borne-recharge' },
  { id: 'prise-renforcee', name: 'Prise renforcée', short: 'PC RENF', icon: 'prise-renforcee' },
];

/** Circuits proposés dans « Quel circuit ? » (ordre d'affichage). */
export const QUICK_CIRCUITS = ['four', 'plaque', 'lave-vaisselle', 'lave-linge', 'prises', 'eclairage', 'refrigerateur', 'vmc', 'chauffe-eau', 'volets'];

export function getPreset(id: string): CircuitPreset | undefined {
  return CIRCUIT_PRESETS.find((p) => p.id === id);
}

/** Expressions → abréviations (les plus longues d'abord). */
const ABBREVIATIONS: [string, string][] = [
  ['prises de courant', 'PC'],
  ['prise de courant', 'PC'],
  ['volets roulants', 'VR'],
  ['volet roulant', 'VR'],
  ['plaque de cuisson', 'PLAQUE'],
  ['plaque induction', 'PLAQUE'],
  ['plaque cuisson', 'PLAQUE'],
  ['borne de recharge', 'BORNE VE'],
  ['salle de bains', 'SDB'],
  ['salle de bain', 'SDB'],
  ['salle d eau', 'SDE'],
  ['rez de chaussee', 'RDC'],
  ['lave vaisselle', 'LV'],
  ['lave linge', 'LL'],
  ['seche linge', 'SL'],
  ['seche serviettes', 'SS'],
  ['chauffe eau', 'CE'],
  ['eclairages', 'ECL'],
  ['eclairage', 'ECL'],
  ['prises', 'PC'],
  ['prise', 'PC'],
  ['refrigerateur', 'FRIGO'],
  ['congelateur', 'CONGÉL'],
  ['climatisation', 'CLIM'],
  ['chauffage', 'CHAUF'],
  ['chambres', 'CH'],
  ['chambre', 'CH'],
  ['exterieur', 'EXT'],
  ['exterieurs', 'EXT'],
  ['etage', 'ÉTAGE'],
  ['sejour', 'SÉJOUR'],
  ['cuisine', 'CUISINE'],
  ['four', 'FOUR'],
  ['vmc', 'VMC'],
];

/**
 * Nom court proposé : « Prises cuisine » → « PC CUISINE »,
 * « Éclairage chambre 2 » → « ECL CH 2 ». Simple suggestion, jamais appliquée d'office.
 */
export function suggestShortLabel(text: string): string {
  let t = ` ${normalizeText(text)} `;
  if (!t.trim()) return '';
  for (const [from, to] of ABBREVIATIONS) t = t.replaceAll(` ${from} `, ` ${to} `);
  return t
    .trim()
    .split(' ')
    .map((w) => w.toUpperCase())
    .join(' ');
}
