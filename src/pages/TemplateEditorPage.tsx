import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Copy, Save } from 'lucide-react';
import type { PanelTemplate, TextAlign } from '../types';
import { BRANDS, computeRowWidthMm, duplicateTemplate, validateTemplate } from '../data/electricalPanelTemplates';
import { getTemplate, saveTemplate } from '../database/templateRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { LabelStripView } from '../components/labels/LabelStripView';
import { Button } from '../components/ui/Button';
import { Card, SectionTitle } from '../components/ui/Card';
import { NumberField, Segmented, SelectField, TextField, Toggle } from '../components/ui/Field';
import { buildLabelStrips } from '../utils/labelLayout';
import { createId } from '../utils/id';
import { toast } from '../store/toastStore';
import type { ElectricalCircuit } from '../types';

const SAMPLE: { name: string; icon: string; modules: number; kind?: ElectricalCircuit['kind'] }[] = [
  { name: 'Différentiel 40A 30mA', icon: 'interrupteur-differentiel', modules: 2, kind: 'differential' },
  { name: 'Éclairage salon', icon: 'point-lumineux', modules: 1 },
  { name: 'Prises salon', icon: 'prise-16a', modules: 1 },
  { name: 'Prises cuisine plan de travail', icon: 'prise-16a', modules: 1 },
  { name: 'Four', icon: 'four', modules: 1 },
  { name: 'Plaque de cuisson', icon: 'plaque-cuisson', modules: 1 },
  { name: 'Lave-vaisselle', icon: 'lave-vaisselle', modules: 1 },
  { name: 'VMC', icon: 'bouche-vmc', modules: 1 },
  { name: 'Chauffe-eau', icon: 'chauffe-eau', modules: 1 },
];

/** Réglage des dimensions d'un modèle d'étiquettes (aucune cote codée en dur). */
export default function TemplateEditorPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<PanelTemplate | null>(null);

  useEffect(() => {
    void getTemplate(templateId).then(setTpl);
  }, [templateId]);

  const preview = useMemo(() => {
    if (!tpl) return null;
    let n = 0;
    const circuits: ElectricalCircuit[] = SAMPLE.map((s, i) => ({
      id: `s${i}`,
      panelId: 'p',
      rowId: 'r',
      order: i,
      number: s.kind === 'differential' ? '' : String(++n),
      name: s.name,
      kind: s.kind ?? 'circuit',
      modules: s.modules,
      protection: '',
      cableSection: '',
      icon: s.icon,
    }));
    return buildLabelStrips([{ id: 'r', name: 'Aperçu' }], circuits, [], tpl)[0];
  }, [tpl]);

  if (!tpl) return <AppHeader title="Réglage des dimensions" back="/templates" />;
  const issues = validateTemplate(tpl);
  const issue = (f: keyof PanelTemplate) => issues.find((i) => i.field === f)?.message ?? null;

  const set = <K extends keyof PanelTemplate>(k: K, v: PanelTemplate[K]) => setTpl((t) => (t ? { ...t, [k]: v } : t));
  const setModules = (n: number) => setTpl((t) => (t ? { ...t, modulesPerRow: Math.round(n), rowWidthMm: computeRowWidthMm(Math.round(n), t.modulePitchMm) } : t));
  const setPitch = (p: number) => setTpl((t) => (t ? { ...t, modulePitchMm: p, rowWidthMm: computeRowWidthMm(t.modulesPerRow, p) } : t));
  const setWidth = (w: number) => setTpl((t) => (t ? { ...t, rowWidthMm: w, modulePitchMm: Math.round((w / t.modulesPerRow) * 1000) / 1000 } : t));

  const save = async () => {
    if (issues.length) {
      toast.error(issues[0].message);
      return;
    }
    await saveTemplate(tpl);
    toast.success('Modèle enregistré ✓');
    navigate(-1);
  };

  const duplicate = async () => {
    const copy = duplicateTemplate(tpl, createId('tpl'), `${tpl.name} (copie)`);
    await saveTemplate(copy);
    toast.success('Modèle dupliqué ✓');
    navigate(`/templates/${copy.id}`, { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Réglage des dimensions" subtitle={tpl.name} back />
      <PageBody className="max-w-4xl">
        {tpl.builtIn && (
          <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            Modèle fabricant : vos réglages sont enregistrés sur cet appareil (réinitialisables). Pour un tableau particulier, préférez <strong>Dupliquer</strong>.
          </p>
        )}
        <SectionTitle>Aperçu</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-2">
          <div className="min-w-[640px]">{preview && <LabelStripView strip={preview} template={tpl} />}</div>
        </div>

        <SectionTitle>Identification</SectionTitle>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <TextField label="Nom modèle" value={tpl.name} onValueChange={(v) => set('name', v)} error={issue('name')} />
          <SelectField label="Marque" value={BRANDS.includes(tpl.brand as (typeof BRANDS)[number]) ? tpl.brand : 'Autre'} onValueChange={(v) => set('brand', v)} options={BRANDS.map((b) => ({ value: b, label: b }))} />
        </Card>

        <SectionTitle>Dimensions (mm)</SectionTitle>
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Nombre modules" value={tpl.modulesPerRow} step={1} min={1} max={40} onNumberChange={setModules} error={issue('modulesPerRow')} />
          <NumberField label="Largeur module" suffix="mm" value={tpl.modulePitchMm} step={0.1} onNumberChange={setPitch} error={issue('modulePitchMm')} />
          <NumberField label="Largeur totale" suffix="mm" value={tpl.rowWidthMm} step={0.1} onNumberChange={setWidth} error={issue('rowWidthMm')} hint="= modules × largeur module" />
          <NumberField label="Hauteur étiquette" suffix="mm" value={tpl.labelHeightMm} step={0.5} onNumberChange={(v) => set('labelHeightMm', v)} error={issue('labelHeightMm')} hint="À mesurer sur votre tableau" />
          <NumberField label="Marge gauche" suffix="mm" value={tpl.marginLeftMm} step={0.5} min={0} onNumberChange={(v) => set('marginLeftMm', Math.max(0, v))} />
          <NumberField label="Marge droite" suffix="mm" value={tpl.marginRightMm} step={0.5} min={0} onNumberChange={(v) => set('marginRightMm', Math.max(0, v))} />
          <NumberField label="Marge haute" suffix="mm" value={tpl.marginTopMm} step={0.5} min={0} onNumberChange={(v) => set('marginTopMm', Math.max(0, v))} />
          <NumberField label="Marge basse" suffix="mm" value={tpl.marginBottomMm} step={0.5} min={0} onNumberChange={(v) => set('marginBottomMm', Math.max(0, v))} />
          <NumberField label="Espacement entre bandes" suffix="mm" value={tpl.spacingMm} step={0.5} min={0} onNumberChange={(v) => set('spacingMm', Math.max(0, v))} />
        </Card>

        <SectionTitle>Texte et style</SectionTitle>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <NumberField label="Taille police" suffix="pt" value={tpl.fontSizePt} step={0.5} onNumberChange={(v) => set('fontSizePt', v)} error={issue('fontSizePt')} />
          <SelectField
            label="Police"
            value={tpl.fontFamily}
            onValueChange={(v) => set('fontFamily', v)}
            options={[
              { value: 'Helvetica', label: 'Helvetica / Arial (recommandée)' },
            ]}
            hint="Police standard intégrée au PDF (fonctionne hors connexion)."
          />
          <NumberField label="Épaisseur bordure" suffix="mm" value={tpl.borderWidthMm} step={0.05} min={0} onNumberChange={(v) => set('borderWidthMm', Math.max(0, v))} />
          <div>
            <p className="mb-1 text-sm font-semibold text-gray-700">Alignement texte</p>
            <Segmented<TextAlign>
              ariaLabel="Alignement du texte"
              value={tpl.textAlign}
              onChange={(v) => set('textAlign', v)}
              options={[
                { value: 'left', label: 'Gauche' },
                { value: 'center', label: 'Centré' },
                { value: 'right', label: 'Droite' },
              ]}
            />
          </div>
          <Toggle label="Afficher pictogramme" checked={tpl.showIcon} onChange={(v) => set('showIcon', v)} />
          <Toggle label="Afficher numéro" checked={tpl.showNumber} onChange={(v) => set('showNumber', v)} />
          <Toggle label="2 lignes maximum" description="Sinon : 1 ligne, police réduite si nécessaire" checked={tpl.maxLines === 2} onChange={(v) => set('maxLines', v ? 2 : 1)} />
        </Card>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button icon={<Copy className="size-5" aria-hidden />} onClick={() => void duplicate()}>
            DUPLIQUER MODÈLE
          </Button>
          <Button variant="primary" icon={<Save className="size-5" aria-hidden />} onClick={() => void save()}>
            Enregistrer
          </Button>
        </div>
      </PageBody>
    </div>
  );
}
