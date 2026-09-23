import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Bluetooth, Download, Eye, Printer, RotateCcw, Ruler, Share2, SlidersHorizontal } from 'lucide-react';
import type { Label, PanelTemplate } from '../types';
import { usePanelLabels } from '../hooks/usePanelLabels';
import { saveLabel, savePanel, deleteLabel } from '../database/panelRepository';
import { saveTemplate } from '../database/templateRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { LabelStripView } from '../components/labels/LabelStripView';
import { Button } from '../components/ui/Button';
import { Badge, Card, EmptyState, SectionTitle } from '../components/ui/Card';
import { SelectField, TextField, Toggle } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { SymbolIcon } from '../components/symbols/SymbolIcon';
import { LABEL_ICON_CHOICES } from '../data/labelIcons';
import { downloadLabelsPdf, printLabelsBluetooth, printLabelsSystem, shareLabelsPdf } from '../services/labels/labelPrint';
import { getCurrentBluetoothPrinter, isWebBluetoothAvailable, BLUETOOTH_UNAVAILABLE_MESSAGE } from '../services/printerService/webBluetoothPrint';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { calibrationSummary } from '../utils/calibration';
import { IDENTITY } from '../services/labels/labelRender';

/** Étiquettes du tableau : choix du fabricant, édition, impression. */
export default function LabelsPage() {
  const { panelId } = useParams();
  const navigate = useNavigate();
  const { panel, circuits, labels, templates, template, strips, printers, printer, project } = usePanelLabels(panelId);
  const updateSettings = useSettingsStore((s) => s.update);
  const [editing, setEditing] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);

  if (!panel || !template) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="Étiquettes" back="/labels" />
      </div>
    );
  }
  const cal = printer?.calibration ?? IDENTITY;
  const name = project?.name ?? panel.name;
  const updateTemplate = (changes: Partial<PanelTemplate>) => void saveTemplate({ ...template, ...changes });

  const act = async (fn: () => Promise<unknown> | unknown, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impression impossible');
    } finally {
      setBusy(false);
    }
  };

  const editingCircuit = circuits.find((c) => c.id === editing);
  const editingLabel = labels.find((l) => l.circuitId === editing);
  const btConnected = Boolean(getCurrentBluetoothPrinter());

  return (
    <div className="min-h-dvh">
      <AppHeader title="Étiquettes tableau" subtitle={name} back={panel.projectId ? `/panel/${panel.id}` : '/labels'} />
      <PageBody className="max-w-5xl">
        <Card className="grid gap-3 p-4 md:grid-cols-2">
          <SelectField
            label="Fabricant / modèle"
            value={panel.templateId}
            onValueChange={(v) => void savePanel({ ...panel, templateId: v })}
            options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.modulesPerRow} × ${t.modulePitchMm} mm = ${t.rowWidthMm} mm)` }))}
          />
          <SelectField
            label="Imprimante (calibration)"
            value={printer?.id ?? ''}
            onValueChange={(v) => updateSettings({ defaultPrinterProfileId: v })}
            options={printers.map((p) => ({ value: p.id, label: p.name }))}
            hint={printer ? calibrationSummary(printer.calibration) : undefined}
          />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button size="sm" icon={<SlidersHorizontal className="size-4" aria-hidden />} onClick={() => navigate(`/templates/${template.id}`)}>
              Dimensions du modèle
            </Button>
            <Button size="sm" icon={<Ruler className="size-4" aria-hidden />} onClick={() => navigate(`/calibration?printer=${printer?.id ?? ''}&template=${template.id}`)}>
              Calibrer mon imprimante
            </Button>
            <Badge tone="yellow">Hauteur : {template.labelHeightMm} mm (à vérifier)</Badge>
          </div>
        </Card>

        <Card className="mt-3 grid gap-x-6 px-4 sm:grid-cols-3">
          <Toggle label="Pictogrammes" checked={template.showIcon} onChange={(v) => updateTemplate({ showIcon: v })} />
          <Toggle label="Numéros" checked={template.showNumber} onChange={(v) => updateTemplate({ showNumber: v })} />
          <Toggle label="2 lignes max." checked={template.maxLines === 2} onChange={(v) => updateTemplate({ maxLines: v ? 2 : 1 })} />
        </Card>

        <SectionTitle>Aperçu des bandes (touchez une étiquette pour la modifier)</SectionTitle>
        {circuits.length === 0 ? (
          <EmptyState title="Aucun circuit" action={<Button variant="primary" onClick={() => navigate(`/panel/${panel.id}`)}>Ajouter des circuits</Button>}>
            Les étiquettes sont générées automatiquement à partir des circuits du tableau.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {strips.map((s) => (
              <div key={s.rowId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-800">{s.rowName}</span>
                  <Badge tone={s.overflow ? 'red' : 'gray'}>
                    {s.usedModules} / {template.modulesPerRow} modules{s.overflow ? ` — ${s.overflow} hors bande` : ''}
                  </Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-2">
                  <div className="min-w-[640px]">
                    <LabelStripView strip={s} template={template} onCellClick={setEditing} highlightId={editing} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Impression</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Exemplaires</span>
            <Button size="sm" onClick={() => setCopies((c) => Math.max(1, c - 1))} aria-label="Moins d’exemplaires">
              −
            </Button>
            <span className="w-6 text-center font-bold tabular-nums">{copies}</span>
            <Button size="sm" onClick={() => setCopies((c) => Math.min(10, c + 1))} aria-label="Plus d’exemplaires">
              +
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Button icon={<Eye className="size-5" aria-hidden />} onClick={() => navigate(`/panel/${panel.id}/preview`)} disabled={!circuits.length}>
              Aperçu
            </Button>
            <Button variant="primary" icon={<Printer className="size-5" aria-hidden />} disabled={busy || !circuits.length} onClick={() => void act(() => printLabelsSystem(strips, template, cal, copies))}>
              Impression système
            </Button>
            <Button icon={<Download className="size-5" aria-hidden />} disabled={busy || !circuits.length} onClick={() => void act(() => downloadLabelsPdf(strips, template, cal, name, copies), 'PDF créé ✓')}>
              PDF
            </Button>
            <Button icon={<Share2 className="size-5" aria-hidden />} disabled={busy || !circuits.length} onClick={() => void act(() => shareLabelsPdf(strips, template, cal, name, copies))}>
              Partager
            </Button>
            <Button
              icon={<Bluetooth className="size-5" aria-hidden />}
              disabled={busy || !circuits.length}
              onClick={() => {
                if (!isWebBluetoothAvailable()) {
                  toast.error(BLUETOOTH_UNAVAILABLE_MESSAGE);
                  return;
                }
                if (!btConnected) {
                  navigate('/printers');
                  toast.info('Connectez d’abord une imprimante Bluetooth compatible.');
                  return;
                }
                void act(() => printLabelsBluetooth(strips, template, cal), 'Étiquettes envoyées ✓');
              }}
            >
              Bluetooth
            </Button>
          </div>
          <p className="rounded-xl bg-yellow-50 p-3 text-sm font-medium text-yellow-900">Lors de l’impression, désactivez l’option « Ajuster à la page » (échelle 100 %).</p>
          <Button variant="ghost" size="sm" icon={<Ruler className="size-4" aria-hidden />} onClick={() => navigate(`/calibration?printer=${printer?.id ?? ''}&template=${template.id}`)}>
            Imprimer une bande test
          </Button>
        </Card>
      </PageBody>

      <LabelEditSheet
        open={Boolean(editingCircuit)}
        title={editingCircuit ? `Étiquette ${editingCircuit.number || ''} — ${editingCircuit.name}` : ''}
        circuitName={editingCircuit?.name ?? ''}
        circuitIcon={editingCircuit?.icon}
        label={editingLabel}
        onClose={() => setEditing(null)}
        onSave={async (text, icon) => {
          if (!editingCircuit) return;
          const same = text === editingCircuit.name && icon === editingCircuit.icon;
          if (same && editingLabel) await deleteLabel(editingLabel.id);
          else if (!same)
            await saveLabel({
              id: editingLabel?.id ?? `lbl_${editingCircuit.id}`,
              panelId: panel.id,
              circuitId: editingCircuit.id,
              text: text !== editingCircuit.name ? text : undefined,
              icon: icon === editingCircuit.icon ? undefined : (icon ?? null),
            });
          toast.success('Étiquette modifiée ✓');
          setEditing(null);
        }}
        onReset={async () => {
          if (editingLabel) await deleteLabel(editingLabel.id);
          setEditing(null);
        }}
      />
    </div>
  );
}

function LabelEditSheet({
  open,
  title,
  circuitName,
  circuitIcon,
  label,
  onClose,
  onSave,
  onReset,
}: {
  open: boolean;
  title: string;
  circuitName: string;
  circuitIcon?: string;
  label?: Label;
  onClose: () => void;
  onSave: (text: string, icon: string | undefined) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState('');
  const [icon, setIcon] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    setText(label?.text ?? circuitName);
    setIcon(label?.icon === null ? undefined : (label?.icon ?? circuitIcon));
  }, [open, label, circuitName, circuitIcon]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      desktop="center"
      footer={
        <div className="flex gap-2">
          <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={onReset}>
            Depuis le circuit
          </Button>
          <Button variant="primary" block onClick={() => onSave(text.trim() || circuitName, icon)}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <TextField label="Texte de l’étiquette" value={text} onValueChange={setText} hint="Le texte est réduit automatiquement (2 lignes max.) pour ne jamais dépasser la case." />
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Pictogramme</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            <button type="button" onClick={() => setIcon(undefined)} className={`min-h-14 rounded-xl border text-xs font-semibold ${!icon ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              Aucun
            </button>
            {LABEL_ICON_CHOICES.map((ic) => (
              <button
                key={ic.symbolId}
                type="button"
                aria-label={ic.label}
                aria-pressed={icon === ic.symbolId}
                onClick={() => setIcon(ic.symbolId)}
                className={`flex min-h-14 items-center justify-center rounded-xl border ${icon === ic.symbolId ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
              >
                <SymbolIcon id={ic.symbolId} size={30} color="#111827" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
