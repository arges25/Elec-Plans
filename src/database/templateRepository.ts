import type { PanelTemplate } from '../types';
import { BUILTIN_PANEL_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../data/electricalPanelTemplates';
import { db } from './db';

/**
 * Modèles d'étiquettes : les modèles intégrés peuvent être ajustés (ex. hauteur),
 * l'ajustement est alors enregistré sous le même identifiant dans `customTemplates`.
 */
export async function listTemplates(): Promise<PanelTemplate[]> {
  const custom = await db.customTemplates.toArray();
  const byId = new Map(custom.map((t) => [t.id, t]));
  const builtins = BUILTIN_PANEL_TEMPLATES.map((b) => {
    const override = byId.get(b.id);
    return override ? { ...b, ...override, builtIn: true } : b;
  });
  const others = custom.filter((t) => !BUILTIN_PANEL_TEMPLATES.some((b) => b.id === t.id)).sort((a, b) => a.name.localeCompare(b.name));
  return [...builtins, ...others];
}

export async function getTemplate(id: string | undefined): Promise<PanelTemplate> {
  const all = await listTemplates();
  return all.find((t) => t.id === id) ?? all.find((t) => t.id === DEFAULT_TEMPLATE_ID) ?? BUILTIN_PANEL_TEMPLATES[0];
}

export async function saveTemplate(tpl: PanelTemplate): Promise<void> {
  await db.customTemplates.put({ ...tpl, updatedAt: Date.now() });
}

/** Supprime un modèle personnalisé, ou réinitialise un modèle intégré. */
export async function deleteTemplate(id: string): Promise<void> {
  await db.customTemplates.delete(id);
}
