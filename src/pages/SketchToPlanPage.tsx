import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, Camera, Check, Crop, FileImage, Loader2, PenLine, RefreshCw, Wand2 } from 'lucide-react';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Slider, Toggle } from '../components/ui/Field';
import { useProjectPlan } from '../hooks/useProjectPlan';
import { updatePlan } from '../database/planRepository';
import { drawToCanvas, get2d, loadImage } from '../services/imageProcessing';
import { isSupportedImage, saveImageToPlan } from '../services/planImport';
import {
  DEFAULT_RECONSTRUCTION_OPTIONS,
  getReconstructionService,
  type ReconstructionOptions,
  type ReconstructionResult,
} from '../services/planReconstruction';
import { confirmDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';

const STEPS = ['Photo du croquis', 'Analyse', 'Plan proposé', 'Correction', 'Implantation électrique'];
const ANALYSIS_MAX_SIDE = 1200;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="no-scrollbar mb-4 flex gap-2 overflow-x-auto" aria-label="Étapes">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === step ? 'step' : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
            i < step ? 'bg-green-100 text-green-800' : i === step ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white/30">
            {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Croquis → Plan : reconstruction automatique d'un plan simplifié (vu de dessus). */
export default function SketchToPlanPage() {
  const { projectId, planId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { project, plan } = useProjectPlan(projectId, planId);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [opts, setOpts] = useState<ReconstructionOptions>(DEFAULT_RECONSTRUCTION_OPTIONS);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ReconstructionResult | null>(null);
  const autoRan = useRef(false);

  const image = plan?.processedImage ?? plan?.originalImage;
  const base = `/project/${projectId}/plan/${planId}`;
  const step = !image ? 0 : progress ? 1 : result ? 2 : 0;

  const onFile = async (file: File | undefined) => {
    if (!file || !planId) return;
    if (!isSupportedImage(file)) {
      toast.error('Format non pris en charge');
      return;
    }
    setProgress('Préparation de la photo…');
    try {
      await saveImageToPlan(planId, file, 'sketch');
      setResult(null);
      toast.success('Photo importée ✓');
      navigate(`${base}/scan?preset=sketch&next=sketch`);
    } finally {
      setProgress(null);
    }
  };

  const analyse = async () => {
    if (!image || !plan) return;
    setResult(null);
    setProgress('Préparation de l’image…');
    try {
      const img = await loadImage(image);
      const canvas = drawToCanvas(img, ANALYSIS_MAX_SIDE);
      const data = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
      const service = getReconstructionService();
      const res = await service.reconstruct(data, { width: plan.width, height: plan.height }, opts, setProgress);
      setResult(res);
    } catch (e) {
      console.error(e);
      toast.error('La détection a échoué : tracez les murs par-dessus le croquis.');
    } finally {
      setProgress(null);
    }
  };

  // Lancement automatique après le recadrage (?step=2)
  useEffect(() => {
    if (params.get('step') === '2' && image && plan && !autoRan.current) {
      autoRan.current = true;
      void analyse();
    }
  }, [image, plan?.id]); // analyse() ne dépend que de l'image courante

  const applyProposedPlan = async () => {
    if (!result || !plan || !planId) return;
    if (plan.vectorData.walls.length > 0) {
      const ok = await confirmDialog({
        title: 'Remplacer les murs existants ?',
        message: `Le plan contient déjà ${plan.vectorData.walls.length} mur(s). Ils seront remplacés par le plan proposé (les symboles sont conservés).`,
        confirmLabel: 'Remplacer',
      });
      if (!ok) return;
    }
    await updatePlan(planId, {
      vectorData: { ...plan.vectorData, walls: result.walls, doors: result.doors, windows: [] },
      reconstructed: true,
      backgroundOpacity: 0.5,
    });
    toast.success('Plan proposé enregistré ✓');
    navigate(`${base}?mode=correction`);
  };

  const traceManually = async () => {
    if (planId) await updatePlan(planId, { backgroundOpacity: 0.6 });
    navigate(`${base}?mode=correction&tool=wall`);
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Croquis → Plan" subtitle={project ? `${project.name} · ${plan?.name ?? ''}` : undefined} back={base} />
      <PageBody className="max-w-4xl">
        <Stepper step={step} />
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          <Wand2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Plan simplifié destiné à l’implantation électrique.</strong> La détection du croquis fonctionne sur l’appareil (aucune image envoyée) ; ce
            n’est pas un plan d’architecte.
          </span>
        </p>

        {!image && (
          <Card className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-gray-700">
              Photographiez une feuille sur laquelle vous avez dessiné les murs, les pièces et les portes (trait foncé, feuille bien éclairée).
            </p>
            <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
              <Button variant="primary" icon={<Camera className="size-5" aria-hidden />} onClick={() => cameraRef.current?.click()}>
                Prendre une photo
              </Button>
              <Button icon={<FileImage className="size-5" aria-hidden />} onClick={() => fileRef.current?.click()}>
                Importer une image
              </Button>
            </div>
          </Card>
        )}

        {image && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {plan && (
                <svg viewBox={`0 0 ${plan.width} ${plan.height}`} className="block w-full" role="img" aria-label="Croquis et murs détectés">
                  <image href={image} x={0} y={0} width={plan.width} height={plan.height} opacity={result ? 0.45 : 1} />
                  {result?.walls.map((w) => (
                    <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#f97316" strokeWidth={w.thickness} strokeLinecap="square" opacity={0.9} />
                  ))}
                  {result?.doors.map((d) => {
                    const w = result.walls.find((x) => x.id === d.wallId);
                    if (!w) return null;
                    const cx = w.x1 + (w.x2 - w.x1) * d.t;
                    const cy = w.y1 + (w.y2 - w.y1) * d.t;
                    return <circle key={d.id} cx={cx} cy={cy} r={Math.max(8, d.width / 2)} fill="rgba(37,99,235,0.25)" stroke="#2563eb" strokeWidth={3} />;
                  })}
                </svg>
              )}
              {progress && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70" role="status">
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 font-semibold shadow-lg">
                    <Loader2 className="size-6 animate-spin text-brand-500" aria-hidden /> {progress}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {result && (
                <Card className="p-4">
                  <p className="text-sm font-bold text-gray-900">Plan proposé</p>
                  <p className="text-sm text-gray-600">
                    {result.walls.length} mur(s) · {result.doors.length} ouverture(s) · détection{' '}
                    {result.method === 'opencv' ? 'OpenCV.js' : result.method === 'local' ? 'simplifiée' : 'distante'}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">Plan simplifié généré automatiquement. Vérifiez les murs et ouvertures avant utilisation.</p>
                  {result.warnings.map((w) => (
                    <p key={w} className="mt-2 flex items-start gap-2 rounded-lg bg-yellow-50 p-2 text-sm font-semibold text-yellow-900">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
                    </p>
                  ))}
                  <div className="mt-3 flex flex-col gap-2">
                    {result.walls.length > 0 && (
                      <Button variant="primary" icon={<Check className="size-5" aria-hidden />} onClick={() => void applyProposedPlan()}>
                        Utiliser et corriger le plan
                      </Button>
                    )}
                    <Button icon={<PenLine className="size-5" aria-hidden />} onClick={() => void traceManually()}>
                      Tracer par-dessus (manuel)
                    </Button>
                  </div>
                </Card>
              )}
              <Card className="flex flex-col gap-1 p-4">
                <p className="text-sm font-bold text-gray-900">Réglages de la détection</p>
                <Slider
                  label="Sensibilité du trait"
                  value={opts.sensitivity}
                  min={3}
                  max={30}
                  onChange={(v) => setOpts((o) => ({ ...o, sensitivity: v }))}
                  format={(v) => `${v}`}
                />
                <Slider
                  label="Longueur minimale d’un mur"
                  value={Math.round(opts.minWallRatio * 100)}
                  min={2}
                  max={20}
                  onChange={(v) => setOpts((o) => ({ ...o, minWallRatio: v / 100 }))}
                  format={(v) => `${v} %`}
                />
                <Toggle
                  label="Murs droits uniquement (0° / 90°)"
                  checked={opts.orthogonalOnly}
                  onChange={(v) => setOpts((o) => ({ ...o, orthogonalOnly: v }))}
                />
                <Toggle label="Détecter les ouvertures" checked={opts.detectOpenings} onChange={(v) => setOpts((o) => ({ ...o, detectOpenings: v }))} />
                <Button
                  variant={result ? 'secondary' : 'primary'}
                  className="mt-2"
                  icon={result ? <RefreshCw className="size-5" aria-hidden /> : <Wand2 className="size-5" aria-hidden />}
                  onClick={() => void analyse()}
                  disabled={Boolean(progress)}
                >
                  {result ? 'Relancer la détection' : 'Lancer la reconstruction automatique'}
                </Button>
                <Button variant="ghost" icon={<Crop className="size-5" aria-hidden />} onClick={() => navigate(`${base}/scan?preset=sketch&next=sketch`)}>
                  Recadrer / redresser la photo
                </Button>
                <Button variant="ghost" icon={<Camera className="size-5" aria-hidden />} onClick={() => cameraRef.current?.click()}>
                  Reprendre une photo
                </Button>
              </Card>
            </div>
          </div>
        )}
      </PageBody>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
    </div>
  );
}
