import { Copy } from 'lucide-react';
import { brandName, getEnclosure, productRatingText } from '../data/catalog';
import { DIN_MODULE_MM, REFERENCE_NOT_PROVIDED } from '../constants';
import { buildBom, bomText } from '../engine/bom';
import { usePanelEditor } from '../store/panelEditorStore';
import { toast } from '../../../store/toastStore';

function fmt(n: number): string {
  return String(n).replace('.', ',');
}

/** Onglet 4 — Nomenclature : appareils identiques regroupés. */
export function BomTab() {
  const project = usePanelEditor((s) => s.doc)!;
  const enc = getEnclosure(project.enclosureId)!;
  const lines = buildBom(project.devices);
  const totalModules = lines.reduce((s, l) => s + l.totalModules, 0);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const copy = async () => {
    const head = `${project.projectName} — ${project.title}\nCoffret : ${brandName(enc.brand)} ${enc.name} (${enc.reference ?? REFERENCE_NOT_PROVIDED})\n`;
    try {
      await navigator.clipboard.writeText(`${head}\n${bomText(lines)}`);
      toast.success('Nomenclature copiée');
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4" data-testid="bom-tab">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nomenclature</h2>
            <p className="text-sm text-slate-600">
              {totalQty} appareil(s) · {fmt(totalModules)} modules sur {enc.totalModules}
            </p>
          </div>
          <button type="button" onClick={() => void copy()} disabled={!lines.length} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40">
            <Copy className="size-4" aria-hidden /> Copier
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-right">Quantité</th>
                <th className="px-3 py-2.5">Fabricant</th>
                <th className="px-3 py-2.5">Référence</th>
                <th className="px-3 py-2.5">Désignation</th>
                <th className="px-3 py-2.5">Calibre</th>
                <th className="px-3 py-2.5 text-right">Largeur modulaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-blue-50/50">
                <td className="px-3 py-2.5 text-right font-bold">1</td>
                <td className="px-3 py-2.5">{brandName(enc.brand)}</td>
                <td className={`px-3 py-2.5 ${enc.reference ? 'font-semibold' : 'text-amber-700'}`}>{enc.reference ?? REFERENCE_NOT_PROVIDED}</td>
                <td className="px-3 py-2.5">{enc.name}</td>
                <td className="px-3 py-2.5">—</td>
                <td className="px-3 py-2.5 text-right">{enc.totalModules} mod. (capacité)</td>
              </tr>
              {lines.map((l) => (
                <tr key={l.product.id}>
                  <td className="px-3 py-2.5 text-right font-bold">{l.quantity}</td>
                  <td className="px-3 py-2.5">{brandName(l.product.brand)}</td>
                  <td className={`px-3 py-2.5 ${l.product.reference ? 'font-semibold' : 'text-amber-700'}`}>{l.product.reference ?? REFERENCE_NOT_PROVIDED}</td>
                  <td className="px-3 py-2.5">{l.product.fullName}</td>
                  <td className="px-3 py-2.5">{productRatingText(l.product) ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    {fmt(l.product.modules)} mod. ({fmt(l.product.modules * DIN_MODULE_MM)} mm)
                  </td>
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Aucun appareil posé pour l’instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
