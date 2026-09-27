import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bluetooth, Download, Eye, Printer, Ruler, Share2 } from 'lucide-react';
import type { PanelTemplate, PrintCalibration, PrinterProfile } from '../../types';
import type { LabelStrip } from '../../utils/labelLayout';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/Field';
import { downloadLabelsPdf, printLabelsBluetooth, printLabelsSystem, shareLabelsPdf } from '../../services/labels/labelPrint';
import { BLUETOOTH_UNAVAILABLE_MESSAGE, getCurrentBluetoothPrinter, isWebBluetoothAvailable } from '../../services/printerService/webBluetoothPrint';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { calibrationSummary } from '../../utils/calibration';

/** Impression des étiquettes : exemplaires, aperçu, impression système, PDF, partage, Bluetooth. */
export function LabelPrintPanel({
  panelId,
  strips,
  template,
  calibration,
  printers,
  printer,
  name,
  disabled,
}: {
  panelId: string;
  strips: LabelStrip[];
  template: PanelTemplate;
  calibration: PrintCalibration;
  printers: PrinterProfile[];
  printer?: PrinterProfile;
  name: string;
  disabled: boolean;
}) {
  const navigate = useNavigate();
  const updateSettings = useSettingsStore((s) => s.update);
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
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
  const off = busy || disabled;
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Imprimante (calibration)"
        value={printer?.id ?? ''}
        onValueChange={(v) => updateSettings({ defaultPrinterProfileId: v })}
        options={printers.map((p) => ({ value: p.id, label: p.name }))}
        hint={printer ? calibrationSummary(printer.calibration) : undefined}
      />
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
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          className="col-span-2"
          icon={<Printer className="size-5" aria-hidden />}
          disabled={off}
          onClick={() => void act(() => printLabelsSystem(strips, template, calibration, copies))}
        >
          Imprimer
        </Button>
        <Button icon={<Eye className="size-5" aria-hidden />} onClick={() => navigate(`/panel/${panelId}/preview`)} disabled={disabled}>
          Aperçu
        </Button>
        <Button
          icon={<Download className="size-5" aria-hidden />}
          disabled={off}
          onClick={() => void act(() => downloadLabelsPdf(strips, template, calibration, name, copies), 'PDF créé ✓')}
        >
          PDF
        </Button>
        <Button
          icon={<Share2 className="size-5" aria-hidden />}
          disabled={off}
          onClick={() => void act(() => shareLabelsPdf(strips, template, calibration, name, copies))}
        >
          Partager
        </Button>
        <Button
          icon={<Bluetooth className="size-5" aria-hidden />}
          disabled={off}
          onClick={() => {
            if (!isWebBluetoothAvailable()) {
              toast.error(BLUETOOTH_UNAVAILABLE_MESSAGE);
              return;
            }
            if (!getCurrentBluetoothPrinter()) {
              navigate('/printers');
              toast.info('Connectez d’abord une imprimante Bluetooth compatible.');
              return;
            }
            void act(() => printLabelsBluetooth(strips, template, calibration), 'Étiquettes envoyées ✓');
          }}
        >
          Bluetooth
        </Button>
      </div>
      <p className="rounded-xl bg-yellow-50 p-3 text-sm font-medium text-yellow-900">
        Lors de l’impression, désactivez l’option « Ajuster à la page » (échelle 100 %).
      </p>
      <Button
        variant="ghost"
        size="sm"
        icon={<Ruler className="size-4" aria-hidden />}
        onClick={() => navigate(`/calibration?printer=${printer?.id ?? ''}&template=${template.id}`)}
      >
        Calibrer mon imprimante (bande test)
      </Button>
    </div>
  );
}
