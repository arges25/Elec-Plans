import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Check, Loader2, RotateCcw, RotateCw, ScanSearch, SlidersHorizontal, Sparkles, Undo2 } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { CropEditor } from '../components/scanner/CropEditor';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Slider, Toggle } from '../components/ui/Field';
import { useProjectPlan } from '../hooks/useProjectPlan';
import {
  DEFAULT_FILTERS,
  type ImageFilters,
  type Quad,
  compressCanvas,
  computeAutoEnhance,
  drawToCanvas,
  filterCanvas,
  get2d,
  isFullQuad,
  loadImage,
  rotateCanvas90,
  rotateCanvasFree,
  warpCanvas,
} from '../services/imageProcessing';
import { updatePlan } from '../database/planRepository';
import { toast } from '../store/toastStore';
import { useIsTablet } from '../hooks/useMediaQuery';

function fullQuad(w: number, h: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  get2d(c).drawImage(src, 0, 0);
  return c;
}

/** Scanner / recadrer : redressement de perspective, rotation, luminosité, contraste, noir et blanc. */
export default function ScannerPage() {
  const { projectId, planId } = useParams();
  const [params] = useSearchParams();
  const preset = params.get('preset');
  const next = params.get('next');
  const navigate = useNavigate();
  const { plan } = useProjectPlan(projectId, planId);
  const isTablet = useIsTablet();

  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [quad, setQuad] = useState<Quad>(fullQuad(1, 1));
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);
  const [rotation, setRotation] = useState(0);
  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(isTablet);
  const loadedFor = useRef<string | null>(null);

  // Chargement de l'image d'origine
  useEffect(() => {
    if (!plan || loadedFor.current === plan.id) return;
    const src = plan.originalImage;
    if (!src) {
      navigate(`/project/${projectId}/plan/${planId}/import`, { replace: true });
      return;
    }
    loadedFor.current = plan.id;
    void loadImage(src).then((img) => {
      const c = drawToCanvas(img);
      setBase(c);
      setQuad(fullQuad(c.width, c.height));
      if (preset === 'scan' || preset === 'sketch') {
        const small = drawToCanvas(c, 600);
        const data = get2d(small).getImageData(0, 0, small.width, small.height).data;
        const auto = computeAutoEnhance(data);
        setFilters({ ...DEFAULT_FILTERS, ...auto, grayscale: true, blackWhite: preset === 'scan' });
      }
    });
  }, [plan, preset, navigate, projectId, planId]);

  const smallBase = useMemo(() => (base ? drawToCanvas(base, 1100) : null), [base]);

  // Aperçu filtré (réduit, rapide)
  useEffect(() => {
    if (!smallBase) return;
    const t = setTimeout(() => setPreview(filterCanvas(cloneCanvas(smallBase), filters)), 60);
    return () => clearTimeout(t);
  }, [smallBase, filters]);

  const rotate90 = (clockwise: boolean) => {
    if (!base) return;
    const r = rotateCanvas90(base, clockwise);
    const w = base.width;
    const h = base.height;
    // Rotation des coins du quadrilatère
    const q = quad.map((p) => (clockwise ? { x: h - p.y, y: p.x } : { x: p.y, y: w - p.x }));
    const ordered = (clockwise ? [q[3], q[0], q[1], q[2]] : [q[1], q[2], q[3], q[0]]) as Quad;
    setBase(r);
    setQuad(ordered);
  };

  const autoEnhance = () => {
    if (!smallBase) return;
    const data = get2d(smallBase).getImageData(0, 0, smallBase.width, smallBase.height).data;
    setFilters((f) => ({ ...f, ...computeAutoEnhance(data), grayscale: true }));
    toast.success('Amélioration automatique appliquée');
  };

  const detectEdges = async () => {
    if (!base) return;
    setBusy('Détection des bords…');
    try {
      const { detectDocumentQuad } = await import('../services/planReconstruction/documentDetection');
      const q = await detectDocumentQuad(base);
      if (q) {
        setQuad(q);
        toast.success('Bords détectés ✓ — ajustez si besoin');
      } else toast.info('Bords non détectés : placez les 4 coins manuellement.');
    } catch {
      toast.error('Détection indisponible (OpenCV non chargé). Placez les coins manuellement.');
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    if (!plan?.originalImage) return;
    loadedFor.current = null;
    setFilters(DEFAULT_FILTERS);
    setRotation(0);
    void loadImage(plan.originalImage).then((img) => {
      const c = drawToCanvas(img);
      setBase(c);
      setQuad(fullQuad(c.width, c.height));
      loadedFor.current = plan.id;
    });
  };

  const apply = useCallback(async () => {
    if (!base || !planId) return;
    setBusy('Traitement du plan…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      let out = isFullQuad(quad, base.width, base.height) ? cloneCanvas(base) : warpCanvas(base, quad);
      out = rotateCanvasFree(out, rotation);
      out = filterCanvas(out, filters);
      const img = compressCanvas(out);
      await updatePlan(planId, {
        processedImage: img.dataUrl,
        width: img.width,
        height: img.height,
        source: preset === 'scan' ? 'scan' : preset === 'sketch' ? 'sketch' : (plan?.source ?? 'photo'),
      });
      toast.success('Plan importé ✓');
      const base_ = `/project/${projectId}/plan/${planId}`;
      navigate(next === 'sketch' || preset === 'sketch' ? `${base_}/sketch?step=2` : base_, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Traitement impossible');
    } finally {
      setBusy(null);
    }
  }, [base, planId, quad, rotation, filters, preset, plan?.source, projectId, navigate, next]);

  const setF = <K extends keyof ImageFilters>(k: K, v: ImageFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const controls = (
    <div className="flex flex-col gap-1 p-4">
      <Slider label="Rotation" value={rotation} min={-45} max={45} step={0.5} onChange={setRotation} format={(v) => `${v.toFixed(1)}°`} />
      <Slider label="Luminosité" value={filters.brightness} min={-100} max={100} onChange={(v) => setF('brightness', v)} />
      <Slider label="Contraste" value={filters.contrast} min={-100} max={100} onChange={(v) => setF('contrast', v)} />
      <Toggle label="Niveaux de gris" checked={filters.grayscale} onChange={(v) => setF('grayscale', v)} />
      <Toggle
        label="Noir et blanc (effet scan)"
        description="Seuillage adaptatif : idéal pour les plans papier."
        checked={filters.blackWhite}
        onChange={(v) => setF('blackWhite', v)}
      />
      {filters.blackWhite && (
        <Slider label="Sensibilité noir et blanc" value={filters.threshold} min={2} max={30} onChange={(v) => setF('threshold', v)} format={(v) => `${v} %`} />
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      <AppHeader
        title={preset === 'sketch' ? 'Photo du croquis' : 'Scanner / recadrer'}
        subtitle="Placez les 4 coins sur les bords du plan"
        back={`/project/${projectId}/plan/${planId}`}
        actions={<IconButton tone="dark" label="Réinitialiser" icon={<Undo2 className="size-5" aria-hidden />} onClick={reset} />}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1">
          {base ? (
            <CropEditor preview={preview} imageWidth={base.width} imageHeight={base.height} quad={quad} onQuadChange={setQuad} rotation={rotation} />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <Loader2 className="mr-2 size-6 animate-spin" aria-hidden /> Chargement de l’image…
            </div>
          )}
        </div>
        {isTablet && <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">{controls}</aside>}
      </div>
      {!isTablet && showAdjust && <div className="max-h-[40dvh] overflow-y-auto border-t border-gray-200 bg-white">{controls}</div>}
      <div className="border-t border-white/10 bg-ink-900 px-2 py-2 pb-safe">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
          <div className="no-scrollbar flex items-center justify-around gap-1 overflow-x-auto sm:justify-start">
            <IconButton tone="dark" label="Rotation 90° à gauche" icon={<RotateCcw className="size-5" aria-hidden />} onClick={() => rotate90(false)} />
            <IconButton tone="dark" label="Rotation 90° à droite" icon={<RotateCw className="size-5" aria-hidden />} onClick={() => rotate90(true)} />
            <IconButton tone="dark" label="Détecter les bords" icon={<ScanSearch className="size-5" aria-hidden />} onClick={() => void detectEdges()} />
            <IconButton tone="dark" label="Amélioration automatique" icon={<Sparkles className="size-5" aria-hidden />} onClick={autoEnhance} />
            {!isTablet && (
              <IconButton
                tone="dark"
                label="Réglages image"
                active={showAdjust}
                icon={<SlidersHorizontal className="size-5" aria-hidden />}
                onClick={() => setShowAdjust((v) => !v)}
              />
            )}
          </div>
          <div className="hidden flex-1 sm:block" />
          <Button variant="primary" icon={<Check className="size-5" aria-hidden />} onClick={() => void apply()} disabled={!base} className="w-full whitespace-nowrap sm:w-auto">
            UTILISER CE PLAN
          </Button>
        </div>
      </div>
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/60" role="status">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-semibold shadow-xl">
            <Loader2 className="size-6 animate-spin text-brand-500" aria-hidden />
            {busy}
          </div>
        </div>
      )}
    </div>
  );
}
