import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bluetooth, BluetoothOff, Pencil, Plus, Ruler, Save, Search, Trash2, Unplug } from 'lucide-react';
import type { PrinterKind } from '../types';
import { BLUETOOTH_PRINTER_PROFILES } from '../data/bluetoothPrinterProfiles';
import { deletePrinterProfile, listPrinterProfiles, newPrinterProfile, savePrinterProfile } from '../database/printerRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Badge, Card, SectionTitle } from '../components/ui/Card';
import { SelectField } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';
import {
  BLUETOOTH_UNAVAILABLE_MESSAGE,
  disconnectBluetoothPrinter,
  getCurrentBluetoothPrinter,
  isBluetoothAdapterAvailable,
  isWebBluetoothAvailable,
  requestAndConnectPrinter,
} from '../services/printerService/webBluetoothPrint';
import { calibrationSummary } from '../utils/calibration';
import { confirmDialog, promptDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';

const KIND_LABELS: Record<PrinterKind, string> = { system: 'Impression système (AirPrint / Wi-Fi)', pdf: 'PDF', bluetooth: 'Bluetooth direct' };

/** Imprimantes : profils de calibration + imprimante Bluetooth (si le navigateur le permet). */
export default function PrintersPage() {
  const navigate = useNavigate();
  const printers = useLiveQuery(() => listPrinterProfiles(), []) ?? [];
  const defaultId = useSettingsStore((s) => s.settings.defaultPrinterProfileId);
  const update = useSettingsStore((s) => s.update);
  const btApi = isWebBluetoothAvailable();
  const [adapter, setAdapter] = useState<boolean | null>(null);
  const [profileId, setProfileId] = useState(BLUETOOTH_PRINTER_PROFILES.find((p) => p.supported)?.id ?? '');
  const [connected, setConnected] = useState(getCurrentBluetoothPrinter());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (btApi) void isBluetoothAdapterAvailable().then(setAdapter);
  }, [btApi]);

  const profile = BLUETOOTH_PRINTER_PROFILES.find((p) => p.id === profileId);

  const connect = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const conn = await requestAndConnectPrinter(profile);
      setConnected(conn);
      toast.success(`Connecté à ${conn.device.name ?? 'l’imprimante'} ✓`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') toast.info('Recherche annulée');
      else toast.error('Connexion imprimante impossible');
    } finally {
      setBusy(false);
    }
  };

  const saveBluetooth = async () => {
    if (!connected || !profile) return;
    const p = newPrinterProfile(connected.device.name ?? 'Imprimante Bluetooth', 'bluetooth');
    p.bluetooth = { profileId: profile.id, deviceName: connected.device.name, deviceId: connected.device.id };
    await savePrinterProfile(p);
    toast.success('Imprimante enregistrée ✓');
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Imprimantes" back />
      <PageBody className="max-w-3xl">
        <SectionTitle
          action={
            <Button
              size="sm"
              variant="ghost"
              className="text-brand-600"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={async () => {
                const name = await promptDialog({ title: 'Nouvelle imprimante', label: 'Nom', placeholder: 'Imprimante atelier' });
                if (name?.trim()) await savePrinterProfile(newPrinterProfile(name.trim()));
              }}
            >
              Ajouter
            </Button>
          }
        >
          Profils d’impression (calibration)
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {printers.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  {p.name} {(defaultId ?? printers[0]?.id) === p.id && <Badge tone="green">Par défaut</Badge>}
                </p>
                <p className="text-xs text-gray-500">{KIND_LABELS[p.kind]}</p>
                <p className="text-xs text-gray-500">{calibrationSummary(p.calibration)}</p>
              </div>
              {(defaultId ?? printers[0]?.id) !== p.id && (
                <Button size="sm" onClick={() => update({ defaultPrinterProfileId: p.id })}>
                  Par défaut
                </Button>
              )}
              <Button size="sm" icon={<Ruler className="size-4" aria-hidden />} onClick={() => navigate(`/calibration?printer=${p.id}`)}>
                Calibrer
              </Button>
              <IconButton
                label={`Renommer ${p.name}`}
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={async () => {
                  const name = await promptDialog({ title: 'Renommer', defaultValue: p.name, label: 'Nom' });
                  if (name?.trim()) await savePrinterProfile({ ...p, name: name.trim() });
                }}
              />
              {printers.length > 1 && (
                <IconButton
                  label={`Supprimer ${p.name}`}
                  icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
                  onClick={async () => {
                    if (await confirmDialog({ title: `Supprimer définitivement ${p.name} ?`, confirmLabel: 'Supprimer', danger: true })) await deletePrinterProfile(p.id);
                  }}
                />
              )}
            </Card>
          ))}
        </div>

        <SectionTitle>Imprimante Bluetooth</SectionTitle>
        {!btApi ? (
          <Card className="flex items-start gap-3 p-4">
            <BluetoothOff className="mt-0.5 size-6 shrink-0 text-gray-400" aria-hidden />
            <div>
              <p className="font-semibold text-gray-900">{BLUETOOTH_UNAVAILABLE_MESSAGE}</p>
              <p className="mt-1 text-sm text-gray-600">
                Web Bluetooth est disponible sur Chrome / Edge (Android, Windows, macOS, ChromeOS). Il n’est pas proposé par Safari sur iPhone / iPad : utilisez AirPrint via l’impression système.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3 p-4">
            {adapter === false && <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">Aucun adaptateur Bluetooth détecté ou Bluetooth désactivé.</p>}
            <SelectField
              label="Profil d’imprimante"
              value={profileId}
              onValueChange={setProfileId}
              options={BLUETOOTH_PRINTER_PROFILES.map((p) => ({ value: p.id, label: `${p.name}${p.supported ? '' : ' — non pris en charge'}` }))}
              hint={profile?.description}
            />
            {profile && !profile.supported && (
              <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">Ce profil n’a pas encore de pilote : utilisez le PDF ou l’impression système.</p>
            )}
            {connected ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">
                  <Bluetooth className="size-3.5" aria-hidden /> Connecté : {connected.device.name ?? 'imprimante'}
                </Badge>
                <Button size="sm" icon={<Save className="size-4" aria-hidden />} onClick={() => void saveBluetooth()}>
                  Enregistrer imprimante
                </Button>
                <Button
                  size="sm"
                  icon={<Unplug className="size-4" aria-hidden />}
                  onClick={() => {
                    disconnectBluetoothPrinter();
                    setConnected(null);
                    toast.info('Imprimante déconnectée');
                  }}
                >
                  Déconnecter
                </Button>
              </div>
            ) : (
              <Button variant="primary" icon={<Search className="size-5" aria-hidden />} loading={busy} disabled={!profile?.supported} onClick={() => void connect()}>
                Rechercher et connecter
              </Button>
            )}
            <p className="text-xs text-gray-500">
              Fonction expérimentale : la communication dépend de chaque imprimante. Aucune connexion n’est simulée ; en cas d’échec, utilisez l’impression système ou le PDF.
            </p>
          </Card>
        )}
      </PageBody>
    </div>
  );
}
