import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Camera, FileImage, FileText, Loader2, PenLine, ScanLine, Wand2 } from 'lucide-react';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { useProjectPlan } from '../hooks/useProjectPlan';
import { isPdf, isSupportedImage, saveCanvasToPlan, saveImageToPlan } from '../services/planImport';
import { updatePlan } from '../database/planRepository';
import { BLANK_PLAN_SIZE } from '../utils/planFactory';
import { toast } from '../store/toastStore';
import type { PDFDocumentProxy } from '../services/pdf/pdfImport';

type Pending = 'photo' | 'scan' | 'image' | 'pdf' | 'sketch';

interface Option {
  id: Pending | 'draw';
  title: string;
  desc: string;
  icon: ReactNode;
  accent?: boolean;
}

const OPTIONS: Option[] = [
  { id: 'photo', title: 'Prendre une photo', desc: 'Photographiez le plan papier, puis recadrez-le.', icon: <Camera className="size-7" aria-hidden /> },
  { id: 'scan', title: 'Scanner un plan', desc: 'Photo + redressement + noir et blanc automatique.', icon: <ScanLine className="size-7" aria-hidden /> },
  { id: 'image', title: 'Importer une image', desc: 'JPG, JPEG, PNG ou WEBP.', icon: <FileImage className="size-7" aria-hidden /> },
  { id: 'pdf', title: 'Importer un PDF', desc: 'Choix de la page si le PDF en contient plusieurs.', icon: <FileText className="size-7" aria-hidden /> },
  { id: 'draw', title: 'Dessiner rapidement', desc: 'Plan vierge : tracez les murs en quelques gestes.', icon: <PenLine className="size-7" aria-hidden /> },
  { id: 'sketch', title: 'Reconstruction depuis croquis', desc: 'Photo d’un croquis → plan simplifié vu de dessus.', icon: <Wand2 className="size-7" aria-hidden />, accent: true },
];

export default function ImportPlanPage() {
  const { projectId, planId } = useParams();
  const navigate = useNavigate();
  const { project, plan } = useProjectPlan(projectId, planId);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ doc: PDFDocumentProxy; thumbs: (string | null)[] } | null>(null);

  const base = `/project/${projectId}/plan/${planId}`;

  const choose = (id: Option['id']) => {
    if (id === 'draw') {
      if (!planId) return;
      void updatePlan(planId, { source: 'blank', width: plan?.width ?? BLANK_PLAN_SIZE.width, height: plan?.height ?? BLANK_PLAN_SIZE.height }).then(() =>
        navigate(`${base}?tool=wall`, { replace: true }),
      );
      return;
    }
    setPending(id);
    if (id === 'photo' || id === 'scan' || id === 'sketch') cameraRef.current?.click();
    else if (id === 'pdf') pdfRef.current?.click();
    else fileRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !planId || !pending) return;
    try {
      if (isPdf(file)) {
        await handlePdf(file);
        return;
      }
      if (!isSupportedImage(file)) {
        toast.error('Format non pris en charge');
        return;
      }
      setBusy('Préparation de l’image…');
      const source = pending === 'pdf' ? 'image' : pending;
      await saveImageToPlan(planId, file, source);
      toast.success('Plan importé ✓');
      if (pending === 'photo') navigate(`${base}/scan`, { replace: true });
      else if (pending === 'scan') navigate(`${base}/scan?preset=scan`, { replace: true });
      else if (pending === 'sketch') navigate(`${base}/sketch`, { replace: true });
      else navigate(base, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Format non pris en charge');
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async (file: File) => {
    setBusy('Lecture du PDF…');
    const { openPdf, renderPdfThumbnail } = await import('../services/pdf/pdfImport');
    const doc = await openPdf(file);
    if (doc.numPages === 1) {
      await importPdfPage(doc, 1);
      return;
    }
    const thumbs: (string | null)[] = Array.from({ length: doc.numPages }, () => null);
    setPdf({ doc, thumbs });
    setBusy(null);
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const t = await renderPdfThumbnail(doc, i);
      setPdf((cur) => (cur && cur.doc === doc ? { doc, thumbs: cur.thumbs.map((x, k) => (k === i - 1 ? t : x)) } : cur));
    }
  };

  const importPdfPage = async (doc: PDFDocumentProxy, page: number) => {
    if (!planId) return;
    setBusy(`Import de la page ${page}…`);
    try {
      const { renderPdfPage } = await import('../services/pdf/pdfImport');
      const canvas = await renderPdfPage(doc, page);
      await saveCanvasToPlan(planId, canvas, 'pdf');
      setPdf(null);
      toast.success('Plan importé ✓');
      navigate(base, { replace: true });
    } catch {
      toast.error('Impossible de lire cette page du PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Importer le plan" subtitle={project ? `${project.name} · ${plan?.name ?? ''}` : undefined} back={`/`} />
      <PageBody className="max-w-3xl">
        <h2 className="mb-1 text-center text-sm font-extrabold uppercase tracking-wider text-gray-500">Comment souhaitez-vous commencer ?</h2>
        <p className="mb-5 text-center text-sm text-gray-500">Formats acceptés : JPG, JPEG, PNG, WEBP, PDF</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              disabled={Boolean(busy)}
              className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow ${
                o.accent ? 'border-brand-300 bg-gradient-to-br from-brand-50 to-yellow-50' : 'border-gray-200 bg-white hover:border-brand-300'
              }`}
            >
              <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${o.accent ? 'bg-brand-500 text-white' : 'bg-ink-900 text-volt-400'}`}>{o.icon}</span>
              <span className="min-w-0">
                <span className="block font-bold text-gray-900">{o.title}</span>
                <span className="block text-sm text-gray-600">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {plan && (plan.originalImage || plan.vectorData.walls.length > 0) && (
          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => navigate(base)}>
              Conserver le plan actuel et ouvrir l’éditeur
            </Button>
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
          void handleFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void handleFile(f);
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void handleFile(f);
        }}
      />

      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/60" role="status">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-semibold shadow-xl">
            <Loader2 className="size-6 animate-spin text-brand-500" aria-hidden />
            {busy}
          </div>
        </div>
      )}

      <Sheet open={Boolean(pdf)} onClose={() => setPdf(null)} title={`Choisir la page (${pdf?.doc.numPages ?? 0})`} desktop="center" widthClass="max-w-3xl" mobileHeight="full">
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {pdf?.thumbs.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pdf && void importPdfPage(pdf.doc, i + 1)}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-2 hover:border-brand-400"
            >
              <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                {t ? <img src={t} alt={`Page ${i + 1}`} className="max-h-full max-w-full object-contain" /> : <Loader2 className="size-6 animate-spin text-gray-400" aria-hidden />}
              </div>
              <span className="text-sm font-semibold">Page {i + 1}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
