import type { PanelTemplate } from '../types';

/**
 * SOURCE UNIQUE des modèles d'étiquettes de tableau électrique.
 *
 * Les pas de module et largeurs proviennent de ces modèles ; aucune autre partie
 * de l'application ne doit coder ces dimensions en dur.
 *
 * ⚠️ La hauteur d'étiquette (`labelHeightMm`) est une valeur par défaut INDICATIVE :
 * elle n'est pas une cote constructeur vérifiée. Mesurez votre porte-étiquette et
 * ajustez-la dans l'éditeur de modèles.
 */

export const DEFAULT_LABEL_HEIGHT_MM = 12;
export const LABEL_HEIGHT_NOTE = 'Hauteur indicative : mesurez le porte-étiquette de votre tableau et ajustez-la.';

/** Largeur d'une rangée = nombre de modules × pas du module. */
export function computeRowWidthMm(modulesPerRow: number, modulePitchMm: number): number {
  return Math.round(modulesPerRow * modulePitchMm * 1000) / 1000;
}

/** Largeur (mm) d'une case d'étiquette couvrant `modules` modules. */
export function cellWidthMm(template: Pick<PanelTemplate, 'modulePitchMm'>, modules: number): number {
  return Math.round(modules * template.modulePitchMm * 1000) / 1000;
}

/** Largeur totale imprimée d'une bande (marges comprises). */
export function stripOuterWidthMm(template: PanelTemplate): number {
  return template.marginLeftMm + template.rowWidthMm + template.marginRightMm;
}

function baseTemplate(partial: Pick<PanelTemplate, 'id' | 'name' | 'brand' | 'modulesPerRow' | 'modulePitchMm'>): PanelTemplate {
  return {
    ...partial,
    rowWidthMm: computeRowWidthMm(partial.modulesPerRow, partial.modulePitchMm),
    labelHeightMm: DEFAULT_LABEL_HEIGHT_MM,
    marginLeftMm: 0,
    marginRightMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    spacingMm: 4,
    fontSizePt: 7,
    fontFamily: 'Helvetica',
    borderWidthMm: 0.2,
    showIcon: true,
    showNumber: true,
    textAlign: 'center',
    maxLines: 2,
    builtIn: true,
    note: LABEL_HEIGHT_NOTE,
  };
}

export const LEGRAND_DRIVIA_13 = baseTemplate({
  id: 'legrand-drivia-13',
  name: 'Legrand Drivia 13',
  brand: 'Legrand',
  modulesPerRow: 13,
  modulePitchMm: 17.5,
});

export const SCHNEIDER_RESI9_13 = baseTemplate({
  id: 'schneider-resi9-13',
  name: 'Schneider Resi9 13',
  brand: 'Schneider',
  modulesPerRow: 13,
  modulePitchMm: 18,
});

export const HAGER_GAMMA_13 = baseTemplate({
  id: 'hager-gamma-13',
  name: 'Hager Gamma+ 13',
  brand: 'Hager',
  modulesPerRow: 13,
  modulePitchMm: 17.5,
});

export const BUILTIN_PANEL_TEMPLATES: PanelTemplate[] = [LEGRAND_DRIVIA_13, SCHNEIDER_RESI9_13, HAGER_GAMMA_13];

export const DEFAULT_TEMPLATE_ID = LEGRAND_DRIVIA_13.id;

export const BRANDS = ['Legrand', 'Schneider', 'Hager', 'Autre'] as const;

/** Duplique un modèle pour créer un modèle personnalisé modifiable. */
export function duplicateTemplate(source: PanelTemplate, id: string, name?: string): PanelTemplate {
  return { ...source, id, name: name ?? `${source.name} (copie)`, builtIn: false, updatedAt: Date.now() };
}

export interface TemplateIssue {
  field: keyof PanelTemplate;
  message: string;
}

/** Vérifie la cohérence d'un modèle (valeurs positives, largeur = modules × pas). */
export function validateTemplate(tpl: PanelTemplate): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  if (!tpl.name.trim()) issues.push({ field: 'name', message: 'Nom du modèle obligatoire.' });
  if (!Number.isInteger(tpl.modulesPerRow) || tpl.modulesPerRow < 1 || tpl.modulesPerRow > 40)
    issues.push({ field: 'modulesPerRow', message: 'Nombre de modules entre 1 et 40.' });
  if (!(tpl.modulePitchMm > 5 && tpl.modulePitchMm < 60)) issues.push({ field: 'modulePitchMm', message: 'Largeur de module invalide.' });
  if (!(tpl.labelHeightMm > 3 && tpl.labelHeightMm < 80)) issues.push({ field: 'labelHeightMm', message: "Hauteur d'étiquette invalide." });
  if (!(tpl.fontSizePt >= 4 && tpl.fontSizePt <= 30)) issues.push({ field: 'fontSizePt', message: 'Taille de police entre 4 et 30 pt.' });
  const expected = computeRowWidthMm(tpl.modulesPerRow, tpl.modulePitchMm);
  if (Math.abs(expected - tpl.rowWidthMm) > 0.05)
    issues.push({ field: 'rowWidthMm', message: `La largeur totale devrait valoir ${expected} mm (modules × largeur module).` });
  return issues;
}
