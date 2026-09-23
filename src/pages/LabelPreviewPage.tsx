import { useState } from 'react';
import { useParams } from 'react-router';
import { CreditCard, Download, Maximize2, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { usePanelLabels } from '../hooks/usePanelLabels';
import { AppHeader } from '../components/layout/AppHeader';
import { LabelStripView } from '../components/labels/LabelStripView';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Sheet } from '../components/ui/Sheet';
import { Slider } from '../components/ui/Field';
import { stripSizeMm } from '../utils/labelLayout';
import { CSS_PX_PER_INCH, MM_PER_INCH } from '../utils/units';
import { useSettingsStore } from '../store/settingsStore';
import { downloadLabelsPdf, printLabelsSystem } from '../services/labels/labelPrint';
import { IDENTITY } from '../services/labels/labelRender';
import { toast } from '../store/toastStore';

const CARD_WIDTH_MM = 85.6;

/** Règle graduée en millimètres. */
function MmRuler({ lengthMm, pxPerMm }: { lengthMm: number; pxPerMm: number }) {
  const ticks = [];
  for (let mm = 0; mm <= lengthMm; mm++) {
    const h = mm % 10 === 0 ? 14 : mm % 5 === 0 ? 9 : 5;
    ticks.push(<line key={mm} x1={mm * pxPerMm} x2={mm * pxPerMm} y1={0} y2={h} stroke="#111827" strokeWidth={mm % 10 === 0 ? 1 : 0.6} />);
    if (mm % 10 === 0 && pxPerMm * 10 > 18)
      ticks.push(
        <text key={`t${mm}`} x={mm * pxPerMm + 2} y={24} fontSize={10} fill="#374151" fontFamily="Helvetica, Arial, sans-serif">
          {mm / 10}
        </text>,
      );
  }
  return (
    <svg width={lengthMm * pxPerMm + 20} height={28} aria-label={`Règle graduée ${lengthMm} mm (chiffres en cm)`} role="img" className="block">
      {ticks}
    </svg>
  );
}

/** Aperçu avant impression, exactement en millimètres. */
export default function LabelPreviewPage() {
  const { panelId } = useParams();
  const { panel, template, strips, printer, project } = usePanelLabels(panelId);
  const screenPxPerMm = useSettingsStore((s) => s.settings.screenPxPerMm);
  const update = useSettingsStore((s) => s.update);
  const realPxPerMm = screenPxPerMm ?? CSS_PX_PER_INCH / MM_PER_INCH;
  const [zoom, setZoom] = useState(1);
  const [calibrating, setCalibrating] = useState(false);
  const [cardPx, setCardPx] = useState(Math.round(CARD_WIDTH_MM * realPxPerMm));

  if (!panel || !template) return <AppHeader title="Aperçu avant impression" back="/labels" />;
  const pxPerMm = realPxPerMm * zoom;
  const size = stripSizeMm(template);
  const cal = printer?.calibration ?? IDENTITY;

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100">
      <AppHeader title="Aperçu avant impression" subtitle={`${template.name} · ${project?.name ?? panel.name}`} back={`/panel/${panel.id}/labels`} />
      <div className="sticky top-14 z-20 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">Impression : 100 %</span>
          <span className="text-sm text-gray-600">Écran : {Math.round(zoom * 100)} %</span>
          <div className="flex-1" />
          <IconButton label="Zoom écran arrière" icon={<ZoomOut className="size-5" aria-hidden />} onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} />
          <IconButton label="Zoom écran avant" icon={<ZoomIn className="size-5" aria-hidden />} onClick={() => setZoom((z) => Math.min(4, z * 1.25))} />
          <Button size="sm" variant={zoom === 1 ? 'dark' : 'secondary'} icon={<Maximize2 className="size-4" aria-hidden />} onClick={() => setZoom(1)}>
            TAILLE RÉELLE
          </Button>
          <Button size="sm" variant="ghost" icon={<CreditCard className="size-4" aria-hidden />} onClick={() => setCalibrating(true)}>
            Calibrer l’écran
          </Button>
        </div>
      </div>
      <main className="flex-1 overflow-auto p-4">
        <p className="mx-auto mb-3 max-w-5xl rounded-xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-900">
          Lors de l’impression, désactivez l’option « Ajuster à la page ». Le zoom écran ne modifie pas la taille imprimée.
        </p>
        <div className="inline-block min-w-full">
          <div className="mb-1 ml-0">
            <MmRuler lengthMm={Math.ceil(size.width)} pxPerMm={pxPerMm} />
          </div>
          <div className="flex flex-col gap-3">
            {strips.map((s) => (
              <div key={s.rowId}>
                <p className="mb-0.5 text-xs font-semibold text-gray-500">
                  {s.rowName} · {size.width.toFixed(1)} × {size.height.toFixed(1)} mm
                </p>
                <div className="inline-block shadow">
                  <LabelStripView strip={s} template={template} pxPerMm={pxPerMm} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <div className="sticky bottom-0 border-t border-gray-200 bg-white p-3 pb-safe">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2">
          <Button variant="primary" icon={<Printer className="size-5" aria-hidden />} onClick={() => printLabelsSystem(strips, template, cal)}>
            Imprimer
          </Button>
          <Button
            icon={<Download className="size-5" aria-hidden />}
            onClick={async () => {
              await downloadLabelsPdf(strips, template, cal, project?.name ?? panel.name);
              toast.success('PDF créé ✓');
            }}
          >
            PDF
          </Button>
        </div>
      </div>

      <Sheet
        open={calibrating}
        onClose={() => setCalibrating(false)}
        title="Calibrer l’écran (taille réelle)"
        desktop="center"
        footer={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                update({ screenPxPerMm: undefined });
                setCardPx(Math.round(CARD_WIDTH_MM * (CSS_PX_PER_INCH / MM_PER_INCH)));
                setCalibrating(false);
              }}
            >
              Réinitialiser
            </Button>
            <Button
              variant="primary"
              block
              onClick={() => {
                update({ screenPxPerMm: cardPx / CARD_WIDTH_MM });
                setCalibrating(false);
                toast.success('Écran calibré ✓');
              }}
            >
              Enregistrer
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-gray-600">Posez une carte bancaire (85,6 mm) sur l’écran et ajustez le rectangle pour qu’il ait exactement la même largeur.</p>
          <div className="overflow-hidden">
            <div className="rounded-xl border-2 border-brand-500 bg-gradient-to-br from-brand-100 to-yellow-100" style={{ width: cardPx, height: cardPx * (53.98 / 85.6) }} />
          </div>
          <Slider label="Largeur" value={cardPx} min={150} max={700} onChange={setCardPx} format={(v) => `${v} px`} />
        </div>
      </Sheet>
    </div>
  );
}
