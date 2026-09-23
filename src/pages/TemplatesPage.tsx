import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { PanelTemplate } from '../types';
import { BUILTIN_PANEL_TEMPLATES, duplicateTemplate } from '../data/electricalPanelTemplates';
import { deleteTemplate, listTemplates, saveTemplate } from '../database/templateRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Badge, Card, SectionTitle } from '../components/ui/Card';
import { IconButton } from '../components/ui/IconButton';
import { useSettingsStore } from '../store/settingsStore';
import { confirmDialog, promptDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { createId } from '../utils/id';

const BRAND_COLORS: Record<string, string> = { Legrand: 'bg-red-600', Schneider: 'bg-green-700', Hager: 'bg-blue-700' };

/** Choix du fabricant et gestion des modèles d'étiquettes. */
export default function TemplatesPage() {
  const navigate = useNavigate();
  const templates = useLiveQuery(() => listTemplates(), []) ?? [];
  const defaultId = useSettingsStore((s) => s.settings.defaultTemplateId);
  const update = useSettingsStore((s) => s.update);

  const duplicate = async (t: PanelTemplate) => {
    const name = await promptDialog({ title: 'Dupliquer le modèle', label: 'Nom du nouveau modèle', defaultValue: `${t.brand} perso` });
    if (!name?.trim()) return;
    const copy = duplicateTemplate(t, createId('tpl'), name.trim());
    await saveTemplate(copy);
    toast.success('Modèle dupliqué ✓');
    navigate(`/templates/${copy.id}`);
  };

  const card = (t: PanelTemplate) => {
    const isBuiltinDefault = BUILTIN_PANEL_TEMPLATES.find((b) => b.id === t.id);
    const modified = isBuiltinDefault && JSON.stringify({ ...isBuiltinDefault, updatedAt: 0 }) !== JSON.stringify({ ...t, updatedAt: 0 });
    return (
      <Card key={t.id} className="flex flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${BRAND_COLORS[t.brand] ?? 'bg-ink-900'}`}>{t.brand.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900">{t.name}</p>
            <p className="text-sm text-gray-600">
              {t.modulesPerRow} modules × {t.modulePitchMm} mm = <strong>{t.rowWidthMm} mm</strong>
            </p>
            <p className="text-xs text-gray-500">Hauteur d’étiquette : {t.labelHeightMm} mm (modifiable, à vérifier)</p>
          </div>
          {defaultId === t.id && <Badge tone="green">Par défaut</Badge>}
          {modified && <Badge tone="orange">Ajusté</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {defaultId !== t.id && (
            <Button size="sm" icon={<Check className="size-4" aria-hidden />} onClick={() => update({ defaultTemplateId: t.id })}>
              Par défaut
            </Button>
          )}
          <Button size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => navigate(`/templates/${t.id}`)}>
            Dimensions
          </Button>
          <Button size="sm" icon={<Copy className="size-4" aria-hidden />} onClick={() => void duplicate(t)}>
            Dupliquer
          </Button>
          {t.builtIn && modified && (
            <IconButton
              label="Réinitialiser le modèle"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={async () => {
                if (await confirmDialog({ title: `Réinitialiser ${t.name} ?`, message: 'Les dimensions d’origine seront restaurées.', confirmLabel: 'Réinitialiser' })) await deleteTemplate(t.id);
              }}
            />
          )}
          {!t.builtIn && (
            <IconButton
              label={`Supprimer ${t.name}`}
              icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
              onClick={async () => {
                if (await confirmDialog({ title: `Supprimer définitivement ${t.name} ?`, confirmLabel: 'Supprimer', danger: true })) {
                  await deleteTemplate(t.id);
                  if (defaultId === t.id) update({ defaultTemplateId: BUILTIN_PANEL_TEMPLATES[0].id });
                }
              }}
            />
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Choix du fabricant" subtitle="Modèles d’étiquettes de tableau" back />
      <PageBody className="max-w-3xl">
        <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
          Les hauteurs d’étiquette sont des valeurs par défaut <strong>non officielles</strong> : mesurez le porte-étiquette de votre tableau et ajustez le modèle.
        </p>
        <SectionTitle>Fabricants</SectionTitle>
        <div className="flex flex-col gap-3">{templates.filter((t) => t.builtIn).map(card)}</div>
        <SectionTitle>Mes modèles personnalisés</SectionTitle>
        <div className="flex flex-col gap-3">
          {templates.filter((t) => !t.builtIn).map(card)}
          {templates.filter((t) => !t.builtIn).length === 0 && <p className="text-sm text-gray-500">Dupliquez un modèle pour créer le vôtre (ex. « Legrand perso garage »).</p>}
        </div>
      </PageBody>
    </div>
  );
}
