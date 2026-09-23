import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Download, Printer } from 'lucide-react';
import type { PrinterProfile } from '../types';
import { listPrinterProfiles, newPrinterProfile, savePrinterProfile } from '../database/printerRepository';
import { listTemplates } from '../database/templateRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Card, SectionTitle } from '../components/ui/Card';
import { NumberField, SelectField, TextField } from '../components/ui/Field';
import { calibrationPdfBlob, printCalibrationSystem } from '../services/labels/labelPrint';
import { layoutCalibrationSheet, primsToSvgInner } from '../services/labels/labelRender';
import { calibrationSummary, computeScaleCorrection, TEST_LENGTH_X_MM, TEST_LENGTH_Y_MM } from '../utils/calibration';
import { canvasMeasure } from '../utils/labelLayout';
import { downloadBlob } from '../utils/download';
import { promptDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';

/** CALIBRER MON IMPRIMANTE : bande test 100 mm → correction d'échelle stockée par imprimante. */
export default function PrintCalibrationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const printers = useLiveQuery(() => listPrinterProfiles(), []) ?? [];
  const templates = useLiveQuery(() => listTemplates(), []) ?? [];
  const defaultPrinter = useSettingsStore((s) => s.settings.defaultPrinterProfileId);
  const defaultTemplate = useSettingsStore((s) => s.settings.defaultTemplateId);
  const [printerId, setPrinterId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>(params.get('template') ?? '');
  const [measuredX, setMeasuredX] = useState('');
  const [measuredY, setMeasuredY] = useState('');
  const [draft, setDraft] = useState<PrinterProfile | null>(null);

  useEffect(() => {
    if (!printers.length || printerId) return;
    const wanted = params.get('printer');
    setPrinterId(printers.find((p) => p.id === wanted)?.id ?? printers.find((p) => p.id === defaultPrinter)?.id ?? printers[0].id);
  }, [printers, printerId, params, defaultPrinter]);

  useEffect(() => {
    const p = printers.find((x) => x.id === printerId);
    if (p) setDraft(p);
  }, [printerId, printers]);

  const template = templates.find((t) => t.id === (templateId || defaultTemplate)) ?? templates[0];
  const sheet = useMemo(() => (template ? layoutCalibrationSheet(template, canvasMeasure) : null), [template]);

  if (!draft || !template || !sheet) return <AppHeader title="Calibrer mon imprimante" back />;
  const cal = draft.calibration;
  const setCal = (changes: Partial<typeof cal>) => setDraft({ ...draft, calibration: { ...cal, ...changes } });

  const applyMeasures = () => {
    try {
      const changes: Partial<typeof cal> = { calibratedAt: Date.now() };
      const mx = Number.parseFloat(measuredX.replace(',', '.'));
      const my = Number.parseFloat(measuredY.replace(',', '.'));
      if (measuredX) {
        changes.scaleX = computeScaleCorrection(TEST_LENGTH_X_MM, mx, cal.scaleX);
        changes.measuredXMm = mx;
      }
      if (measuredY) {
        changes.scaleY = computeScaleCorrection(TEST_LENGTH_Y_MM, my, cal.scaleY);
        changes.measuredYMm = my;
      }
      if (!measuredX && !measuredY) {
        toast.error('Saisissez au moins la longueur mesurée du trait de 100 mm');
        return;
      }
      setCal(changes);
      setMeasuredX('');
      setMeasuredY('');
      toast.success('Correction calculée — enregistrez puis réimprimez une bande test pour vérifier');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mesure invalide');
    }
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Calibrer mon imprimante" back />
      <PageBody className="max-w-4xl">
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <SelectField
            label="Imprimante"
            value={printerId}
            onValueChange={setPrinterId}
            options={printers.map((p) => ({ value: p.id, label: p.name }))}
            hint={calibrationSummary(cal)}
          />
          <SelectField
            label="Modèle pour les 13 cases"
            value={template.id}
            onValueChange={setTemplateId}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Button
            size="sm"
            variant="ghost"
            className="justify-start text-brand-600 sm:col-span-2"
            onClick={async () => {
              const name = await promptDialog({ title: 'Nouvelle imprimante', label: 'Nom', placeholder: 'Imprimante bureau' });
              if (!name?.trim()) return;
              const p = newPrinterProfile(name.trim());
              await savePrinterProfile(p);
              setPrinterId(p.id);
            }}
          >
            + Ajouter une imprimante
          </Button>
        </Card>

        <SectionTitle>1. Imprimer la bande test</SectionTitle>
        <Card className="p-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <svg
              viewBox={`0 0 ${sheet.width} ${sheet.height}`}
              className="block min-w-[560px]"
              dangerouslySetInnerHTML={{ __html: primsToSvgInner(sheet.prims) }}
              role="img"
              aria-label="Bande test : MG Elec & Plans, TEST 100 mm, règle et 13 cases"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="primary" icon={<Printer className="size-5" aria-hidden />} onClick={() => printCalibrationSystem(template, cal)}>
              IMPRIMER UNE BANDE TEST
            </Button>
            <Button
              icon={<Download className="size-5" aria-hidden />}
              onClick={async () => {
                downloadBlob(await calibrationPdfBlob(template, cal), 'mg-elec-bande-test-100mm.pdf');
                toast.success('PDF créé ✓');
              }}
            >
              PDF bande test
            </Button>
          </div>
          <p className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-900">
            Lors de l’impression, désactivez l’option « Ajuster à la page » (échelle 100 %).
          </p>
        </Card>

        <SectionTitle>2. Mesurer</SectionTitle>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <TextField
            label="Quelle longueur mesurez-vous réellement ? (trait 100 mm)"
            suffix="mm"
            inputMode="decimal"
            placeholder="98,7"
            value={measuredX}
            onValueChange={setMeasuredX}
          />
          <TextField
            label="Trait vertical 50 mm (facultatif)"
            suffix="mm"
            inputMode="decimal"
            placeholder="50"
            value={measuredY}
            onValueChange={setMeasuredY}
          />
          <Button variant="dark" className="sm:col-span-2" onClick={applyMeasures}>
            Calculer la correction
          </Button>
        </Card>

        <SectionTitle>3. Réglage fin</SectionTitle>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <NumberField
            label="Scale X"
            value={cal.scaleX}
            step={0.001}
            onNumberChange={(v) => setCal({ scaleX: v })}
            hint={`${((cal.scaleX - 1) * 100).toFixed(2)} %`}
          />
          <NumberField
            label="Scale Y"
            value={cal.scaleY}
            step={0.001}
            onNumberChange={(v) => setCal({ scaleY: v })}
            hint={`${((cal.scaleY - 1) * 100).toFixed(2)} %`}
          />
          <NumberField label="Offset X" suffix="mm" value={cal.offsetXMm} step={0.1} onNumberChange={(v) => setCal({ offsetXMm: v })} />
          <NumberField label="Offset Y" suffix="mm" value={cal.offsetYMm} step={0.1} onNumberChange={(v) => setCal({ offsetYMm: v })} />
        </Card>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button onClick={() => setCal({ scaleX: 1, scaleY: 1, offsetXMm: 0, offsetYMm: 0 })}>Réinitialiser</Button>
          <Button
            variant="success"
            icon={<Check className="size-5" aria-hidden />}
            onClick={async () => {
              await savePrinterProfile(draft);
              toast.success('Calibration enregistrée ✓');
              navigate(-1);
            }}
          >
            Enregistrer la calibration
          </Button>
        </div>
      </PageBody>
    </div>
  );
}
