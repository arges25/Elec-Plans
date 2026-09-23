/**
 * Pictogrammes utilisables sur les étiquettes de tableau.
 * Chaque pictogramme réutilise un symbole de la bibliothèque (mêmes primitives vectorielles).
 */
export const LABEL_ICON_CHOICES: { symbolId: string; label: string }[] = [
  { symbolId: 'point-lumineux', label: 'Éclairage' },
  { symbolId: 'prise-16a', label: 'Prises' },
  { symbolId: 'prise-32a', label: 'Prise 32A' },
  { symbolId: 'four', label: 'Four' },
  { symbolId: 'plaque-cuisson', label: 'Plaque' },
  { symbolId: 'lave-vaisselle', label: 'Lave-vaisselle' },
  { symbolId: 'lave-linge', label: 'Lave-linge' },
  { symbolId: 'seche-linge', label: 'Sèche-linge' },
  { symbolId: 'refrigerateur', label: 'Réfrigérateur' },
  { symbolId: 'congelateur', label: 'Congélateur' },
  { symbolId: 'chauffe-eau', label: 'Chauffe-eau' },
  { symbolId: 'bouche-vmc', label: 'VMC' },
  { symbolId: 'radiateur-electrique', label: 'Chauffage' },
  { symbolId: 'seche-serviettes', label: 'Sèche-serviettes' },
  { symbolId: 'commande-volet', label: 'Volets' },
  { symbolId: 'moteur-portail', label: 'Portail' },
  { symbolId: 'borne-recharge-ve', label: 'Borne VE' },
  { symbolId: 'prise-rj45', label: 'Réseau' },
  { symbolId: 'detecteur-fumee', label: 'Détecteur' },
  { symbolId: 'interrupteur-differentiel', label: 'Différentiel' },
  { symbolId: 'disjoncteur', label: 'Disjoncteur' },
  { symbolId: 'climatisation', label: 'Climatisation' },
  { symbolId: 'pompe-a-chaleur', label: 'PAC' },
  { symbolId: 'prise-ext-ip44', label: 'Extérieur' },
  { symbolId: 'micro-ondes', label: 'Micro-ondes' },
  { symbolId: 'hotte', label: 'Hotte' },
  { symbolId: 'sonnette', label: 'Sonnette' },
  { symbolId: 'passerelle-domotique', label: 'Domotique' },
];

const RULES: { re: RegExp; icon: string }[] = [
  { re: /diff|\bid\b|30\s?ma/i, icon: 'interrupteur-differentiel' },
  { re: /eclair|éclair|lumi|spot|applique|plafon/i, icon: 'point-lumineux' },
  { re: /plaque|cuisson|induction|cuisini/i, icon: 'plaque-cuisson' },
  { re: /four/i, icon: 'four' },
  { re: /lave[- ]?vaisselle/i, icon: 'lave-vaisselle' },
  { re: /lave[- ]?linge|machine a laver|machine à laver/i, icon: 'lave-linge' },
  { re: /s[eè]che[- ]?linge/i, icon: 'seche-linge' },
  { re: /s[eè]che[- ]?serviette/i, icon: 'seche-serviettes' },
  { re: /chauffe[- ]?eau|cumulus|ballon|ecs/i, icon: 'chauffe-eau' },
  { re: /vmc|ventil/i, icon: 'bouche-vmc' },
  { re: /frigo|r[ée]frig/i, icon: 'refrigerateur' },
  { re: /cong[ée]l/i, icon: 'congelateur' },
  { re: /volet|store/i, icon: 'commande-volet' },
  { re: /portail|garage/i, icon: 'moteur-portail' },
  { re: /borne|recharge|v[ée]hicule|irve/i, icon: 'borne-recharge-ve' },
  { re: /clim/i, icon: 'climatisation' },
  { re: /pac|pompe/i, icon: 'pompe-a-chaleur' },
  { re: /chauff|radiat|convect/i, icon: 'radiateur-electrique' },
  { re: /r[ée]seau|rj45|box|informatique|coffret com/i, icon: 'prise-rj45' },
  { re: /micro[- ]?onde/i, icon: 'micro-ondes' },
  { re: /hotte/i, icon: 'hotte' },
  { re: /sonnette|carillon/i, icon: 'sonnette' },
  { re: /domoti/i, icon: 'passerelle-domotique' },
  { re: /ext[ée]rieur|jardin|terrasse/i, icon: 'prise-ext-ip44' },
  { re: /prise|pc\b/i, icon: 'prise-16a' },
];

/** Propose un pictogramme à partir du nom du circuit. */
export function guessCircuitIcon(name: string): string | undefined {
  return RULES.find((r) => r.re.test(name))?.icon;
}
