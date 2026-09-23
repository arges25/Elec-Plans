import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Database, Download, FileUp, Info, Printer, RotateCcw, Ruler, Shapes, SlidersHorizontal, Smartphone, Trash2, Wand2 } from 'lucide-react';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { InstallPrompt } from '../components/onboarding/InstallPrompt';
import { Button } from '../components/ui/Button';
import { Card, SectionTitle } from '../components/ui/Card';
import { SelectField, Slider, Toggle } from '../components/ui/Field';
import { db } from '../database/db';
import { listTemplates } from '../database/templateRepository';
import { DEFAULT_SETTINGS } from '../database/settingsRepository';
import { useSettingsStore } from '../store/settingsStore';
import { confirmDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { exportProjectFile, MGEPLAN_EXTENSION } from '../services/projectTransfer';
import { importProjectWithToast } from '../services/projectActions';
import { isRemoteReconstructionConfigured } from '../services/planReconstruction/remoteAIPlanReconstruction';
import { formatBytes } from '../utils/format';

const COLORS = ['#f97316', '#ea580c', '#facc15', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#6b7280', '#111827'];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="py-2">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} : ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`size-11 rounded-xl border-2 ${value === c ? 'border-ink-900 ring-2 ring-brand-200' : 'border-white shadow'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function LinkRow({ icon, label, desc, onClick }: { icon: ReactNode; label: string; desc?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
      <span className="text-gray-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-gray-900">{label}</span>
        {desc && <span className="block text-xs text-gray-500">{desc}</span>}
      </span>
      <ChevronRight className="size-5 text-gray-400" aria-hidden />
    </button>
  );
}

/** Réglages : Application, Éditeur, Symboles, Étiquettes, Impression, Stockage, Informations. */
export default function SettingsPage() {
  const navigate = useNavigate();
  const s = useSettingsStore((st) => st.settings);
  const update = useSettingsStore((st) => st.update);
  const templates = useLiveQuery(() => listTemplates(), []) ?? [];
  const projectCount = useLiveQuery(() => db.projects.count(), []) ?? 0;
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [cvState, setCvState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshStorage = async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setStorage({ usage: est?.usage, quota: est?.quota, persisted });
    } catch {
      /* indisponible */
    }
  };
  useEffect(() => {
    void refreshStorage();
  }, []);

  const exportAll = async () => {
    const projects = await db.projects.toArray();
    for (const p of projects) await exportProjectFile(p.id);
    toast.success(`${projects.length} projet(s) exporté(s) ✓`);
  };

  const wipe = async () => {
    const ok = await confirmDialog({
      title: 'Effacer toutes les données ?',
      message: `${projectCount} projet(s), tableaux, modèles et réglages seront supprimés définitivement de cet appareil. Exportez vos projets avant si nécessaire.`,
      confirmLabel: 'Tout effacer',
      danger: true,
    });
    if (!ok) return;
    await db.delete();
    localStorage.clear();
    window.location.reload();
  };

  const prepareOpenCv = async () => {
    setCvState('loading');
    try {
      const { loadOpenCv } = await import('../services/planReconstruction/opencvLoader');
      await loadOpenCv();
      setCvState('ready');
      toast.success('Détection de croquis prête hors connexion ✓');
    } catch {
      setCvState('error');
      toast.error('Téléchargement d’OpenCV.js impossible (connexion requise)');
    }
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Réglages" back="/" />
      <PageBody className="max-w-2xl">
        <SectionTitle>Application</SectionTitle>
        <Card className="px-4 py-2">
          <div className="py-2">
            <InstallPrompt force />
          </div>
          <LinkRow
            icon={<Smartphone className="size-5" />}
            label="Revoir le tour guidé"
            onClick={() => {
              update({ onboardingDone: false });
              navigate('/');
            }}
          />
          <Toggle
            label="Afficher l’aide d’installation"
            description="Bandeau « Installer MG Elec & Plans » sur l’accueil"
            checked={!s.installHintDismissed}
            onChange={(v) => update({ installHintDismissed: !v })}
          />
        </Card>

        <SectionTitle>Éditeur</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <Toggle
            label="Aimantation aux murs"
            description="Prises, interrupteurs… s’orientent automatiquement"
            checked={s.snapEnabled}
            onChange={(v) => update({ snapEnabled: v })}
          />
          <Slider
            label="Distance d’aimantation"
            value={s.snapDistance}
            min={5}
            max={40}
            onChange={(v) => update({ snapDistance: v })}
            format={(v) => `${v} px`}
          />
          <Toggle label="Grille" checked={s.gridEnabled} onChange={(v) => update({ gridEnabled: v })} />
          <Slider label="Taille de la grille" value={s.gridSize} min={10} max={100} step={5} onChange={(v) => update({ gridSize: v })} format={(v) => `${v}`} />
          <Toggle label="Afficher les repères d’alignement" checked={s.showGuides} onChange={(v) => update({ showGuides: v })} />
          <Toggle
            label="Mode répétition par défaut"
            description="L’outil reste actif après chaque placement"
            checked={s.repeatMode}
            onChange={(v) => update({ repeatMode: v })}
          />
          <Toggle label="Vibration (si disponible)" checked={s.vibration} onChange={(v) => update({ vibration: v })} />
          <Toggle label="Afficher « Commande N » sur les liaisons" checked={s.showCommandNumbers} onChange={(v) => update({ showCommandNumbers: v })} />
          <ColorRow label="Couleur liaison commande" value={s.commandColor} onChange={(c) => update({ commandColor: c })} />
          <ColorRow label="Couleur liaison circuit" value={s.circuitColor} onChange={(c) => update({ circuitColor: c })} />
          <ColorRow label="Couleur liaison information" value={s.informationColor} onChange={(c) => update({ informationColor: c })} />
          <Slider
            label="Épaisseur des lignes"
            value={s.lineWidth}
            min={1}
            max={6}
            step={0.5}
            onChange={(v) => update({ lineWidth: v })}
            format={(v) => `${v}`}
          />
        </Card>

        <SectionTitle>Symboles</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <Slider
            label="Taille par défaut des symboles"
            value={s.defaultSymbolScale}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(v) => update({ defaultSymbolScale: v })}
            format={(v) => `${Math.round(v * 100)} %`}
          />
          <LinkRow
            icon={<Shapes className="size-5" />}
            label="Bibliothèque et favoris"
            desc={`${s.favorites.length} favori(s)`}
            onClick={() => navigate('/library')}
          />
          <div className="flex gap-2 py-3">
            <Button size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => update({ favorites: DEFAULT_SETTINGS.favorites })}>
              Favoris par défaut
            </Button>
            <Button size="sm" onClick={() => update({ recentSymbols: [] })}>
              Effacer les récents
            </Button>
          </div>
        </Card>

        <SectionTitle>Étiquettes</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <div className="py-3">
            <SelectField
              label="Modèle par défaut"
              value={s.defaultTemplateId}
              onValueChange={(v) => update({ defaultTemplateId: v })}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <LinkRow
            icon={<SlidersHorizontal className="size-5" />}
            label="Modèles et dimensions"
            desc="Legrand · Schneider · Hager · personnalisés"
            onClick={() => navigate('/templates')}
          />
        </Card>

        <SectionTitle>Impression</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <LinkRow icon={<Printer className="size-5" />} label="Imprimantes" desc="Profils, Bluetooth (si compatible)" onClick={() => navigate('/printers')} />
          <LinkRow icon={<Ruler className="size-5" />} label="Calibrer mon imprimante" desc="Bande test 100 mm" onClick={() => navigate('/calibration')} />
        </Card>

        <SectionTitle>Croquis → Plan</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <div className="flex items-center gap-3 py-3">
            <Wand2 className="size-5 text-gray-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Reconstruction automatique locale (OpenCV.js)</p>
              <p className="text-xs text-gray-500">Téléchargée à la première utilisation (≈ 10 Mo) puis disponible hors connexion.</p>
            </div>
            <Button size="sm" loading={cvState === 'loading'} onClick={() => void prepareOpenCv()} disabled={cvState === 'ready'}>
              {cvState === 'ready' ? 'Prête ✓' : 'Préparer'}
            </Button>
          </div>
          <p className="py-3 text-sm text-gray-600">
            Service distant (IA) : <strong>{isRemoteReconstructionConfigured() ? 'configuré' : 'non configuré — désactivé'}</strong>. Aucune image n’est
            envoyée.
          </p>
        </Card>

        <SectionTitle>Stockage</SectionTitle>
        <Card className="divide-y divide-gray-100 px-4">
          <div className="flex items-center gap-3 py-3">
            <Database className="size-5 text-gray-500" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-gray-900">{projectCount} projet(s) sur cet appareil</p>
              <p className="text-gray-500">
                {storage.usage !== undefined ? `${formatBytes(storage.usage)} utilisés` : 'Utilisation inconnue'}
                {storage.quota ? ` sur ${formatBytes(storage.quota)}` : ''} · {storage.persisted ? 'stockage persistant ✓' : 'stockage non persistant'}
              </p>
            </div>
            {!storage.persisted && (
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await navigator.storage?.persist?.();
                  await refreshStorage();
                  if (ok) toast.success('Stockage persistant activé ✓');
                  else toast.info('Le navigateur n’a pas accordé le stockage persistant (installez l’application).');
                }}
              >
                Protéger
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 py-3">
            <Button size="sm" icon={<Download className="size-4" aria-hidden />} onClick={() => void exportAll()} disabled={!projectCount}>
              Exporter tous les projets
            </Button>
            <Button size="sm" icon={<FileUp className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
              Importer un projet
            </Button>
          </div>
          <div className="py-3">
            <Button size="sm" variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => void wipe()}>
              Effacer toutes les données
            </Button>
          </div>
        </Card>
        <input
          ref={fileRef}
          type="file"
          accept={`${MGEPLAN_EXTENSION},application/json,.json`}
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) {
              const id = await importProjectWithToast(f);
              if (id) navigate(`/project/${id}`);
            }
          }}
        />

        <SectionTitle>Informations</SectionTitle>
        <Card className="px-4">
          <LinkRow
            icon={<Info className="size-5" />}
            label="À propos de MG Elec & Plans"
            desc={`Version ${__APP_VERSION__} · Vos projets sont stockés localement sur cet appareil.`}
            onClick={() => navigate('/about')}
          />
        </Card>
      </PageBody>
    </div>
  );
}
