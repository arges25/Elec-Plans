import type { ReactNode } from 'react';
import { ArrowRightLeft, Copy, ExternalLink, LayoutGrid, Move, Pencil, Rows3, Tag, Trash2 } from 'lucide-react';
import type { PlacedDevice } from '../types';
import { DEVICE_KIND_LABELS, brandName, getEnclosure, getProduct, productRatingText, productVariants } from '../data/catalog';
import { DIN_MODULE_MM, NOT_PROVIDED, REFERENCE_NOT_PROVIDED } from '../constants';
import { devicesInRow, usedModules, zoneOf } from '../engine/placement';
import { capacityOf, usePanelEditor } from '../store/panelEditorStore';
import { SharedDefs } from '../render/BoardDefs';
import { LabelEditor } from './LabelEditor';
import { DeviceThumb } from './DeviceThumb';
import { EnclosureInfo } from './EnclosureInfo';
import { toast } from '../../../store/toastStore';
import { confirmDialog } from '../../../store/dialogStore';

/** Panneau de propriétés : appareil sélectionné, étiquette, ou tableau. */

function fmt(n: number): string {
  return String(n).replace('.', ',');
}

export function InfoRow({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`text-right font-semibold ${muted ? 'font-normal text-amber-700' : 'text-slate-900'}`}>{children}</span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, danger, testId }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs font-semibold ${
        danger ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function DeviceActions({ device, onLabel, onMove }: { device: PlacedDevice; onLabel: () => void; onMove?: () => void }) {
  const editor = usePanelEditor.getState;
  const product = getProduct(device.productId);
  const variants = product ? productVariants(product.id) : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        <ActionButton
          testId="action-move"
          icon={<Move className="size-5" aria-hidden />}
          label="Déplacer"
          onClick={() => {
            editor().setMoveDevice(device.id);
            onMove?.();
          }}
        />
        <ActionButton
          testId="action-duplicate"
          icon={<Copy className="size-5" aria-hidden />}
          label="Dupliquer"
          onClick={() => {
            const r = editor().duplicateDevice(device.id);
            if (!r.ok) toast.error(r.message ?? 'Duplication impossible');
          }}
        />
        <ActionButton testId="action-label" icon={<Tag className="size-5" aria-hidden />} label="Étiquette" onClick={onLabel} />
        <ActionButton testId="action-delete" icon={<Trash2 className="size-5" aria-hidden />} label="Supprimer" danger onClick={() => editor().removeDevice(device.id)} />
      </div>
      {variants.length > 1 && (
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Pencil className="size-4" aria-hidden /> Modifier l’appareil
          </span>
          <select
            value={device.productId}
            onChange={(e) => {
              const r = editor().replaceProduct(device.id, e.target.value);
              if (!r.ok) toast.error(r.message ?? 'Modification impossible');
            }}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
            aria-label="Modifier l’appareil"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.fullName} ({fmt(v.modules)} mod.)
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function DeviceDetails({ device }: { device: PlacedDevice }) {
  const product = getProduct(device.productId);
  if (!product) return <p className="text-sm text-slate-500">Produit introuvable dans la base.</p>;
  const rating = productRatingText(product);
  return (
    <div className="divide-y divide-slate-100">
      <InfoRow label="Fabricant">{brandName(product.brand)}</InfoRow>
      <InfoRow label="Gamme">{product.family}</InfoRow>
      <InfoRow label="Référence" muted={!product.reference}>
        {product.reference ?? REFERENCE_NOT_PROVIDED}
      </InfoRow>
      <InfoRow label="Type">{DEVICE_KIND_LABELS[product.kind]}</InfoRow>
      {rating && <InfoRow label="Calibre">{rating}</InfoRow>}
      {product.poles && <InfoRow label="Pôles">{product.poles}</InfoRow>}
      <InfoRow label="Largeur modulaire">
        {fmt(product.modules)} module{product.modules > 1 ? 's' : ''} ({fmt(product.modules * DIN_MODULE_MM)} mm)
      </InfoRow>
      <InfoRow label="Largeur physique" muted={!product.widthMm}>
        {product.widthMm ? `${fmt(product.widthMm)} mm` : NOT_PROVIDED}
      </InfoRow>
      <InfoRow label="Position">
        Rangée {device.row + 1} · module {fmt(device.startModule + 1)}
        {device.moduleWidth > 1 ? ` à ${fmt(device.startModule + device.moduleWidth)}` : ''}
      </InfoRow>
      <InfoRow label="Source" muted={!product.sourceUrl}>
        {product.sourceUrl ? (
          <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline">
            {product.sourceName} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          'Non vérifiée'
        )}
      </InfoRow>
    </div>
  );
}

function BoardSummary() {
  const project = usePanelEditor((s) => s.project)!;
  const enc = getEnclosure(project.enclosureId);
  if (!enc) return null;
  const cap = capacityOf(project);
  const total = project.devices.reduce((s, d) => s + d.moduleWidth, 0);
  return (
    <div className="space-y-4 p-4">
      <EnclosureInfo enclosure={enc} />
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-800">Occupation</h3>
        <p className="mb-2 text-xs text-slate-500">
          {fmt(total)} / {cap.rows * cap.modulesPerRow} modules utilisés · {project.devices.length} appareil(s)
        </p>
        <div className="space-y-2">
          {Array.from({ length: cap.rows }, (_, r) => {
            const used = usedModules(project.devices, r);
            const pct = Math.min(100, (used / cap.modulesPerRow) * 100);
            const count = devicesInRow(project.devices, r).length;
            return (
              <div key={r} className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold">Rangée {r + 1}</span>
                  <span className={`text-xs font-semibold ${used >= cap.modulesPerRow ? 'text-red-600' : 'text-slate-500'}`}>
                    {used >= cap.modulesPerRow ? 'Rangée complète' : `${fmt(cap.modulesPerRow - used)} module(s) libre(s)`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${used >= cap.modulesPerRow ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    disabled={!count}
                    onClick={() => {
                      const res = usePanelEditor.getState().duplicateRow(r);
                      if (!res.ok) toast.error(res.message ?? 'Duplication impossible');
                      else toast.success(`Rangée ${r + 1} dupliquée`);
                    }}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Rows3 className="size-3.5" aria-hidden /> Dupliquer la rangée
                  </button>
                  <button
                    type="button"
                    disabled={!count}
                    onClick={async () => {
                      if (await confirmDialog({ title: `Vider la rangée ${r + 1} ?`, message: `${count} appareil(s) seront retirés (annulable).`, confirmLabel: 'Vider', danger: true }))
                        usePanelEditor.getState().clearRow(r);
                    }}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Vider
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled={!project.devices.length}
          onClick={() => {
            const res = usePanelEditor.getState().autoArrange();
            if (!res.ok) toast.error(res.message ?? 'Organisation impossible');
            else toast.success('Appareils serrés à gauche, rangée par rangée');
          }}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
        >
          <LayoutGrid className="size-4" aria-hidden /> Organisation automatique
        </button>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
          Numéroter les modules
          <input
            type="checkbox"
            checked={project.showModuleNumbers}
            onChange={(e) => usePanelEditor.getState().setMeta({ showModuleNumbers: e.target.checked })}
            className="size-5 accent-blue-600"
          />
        </label>
      </div>
      <p className="text-xs leading-snug text-slate-500">
        <ArrowRightLeft className="mr-1 inline size-3.5" aria-hidden />
        Glissez un appareil depuis la bibliothèque sur un rail. Sur téléphone : touchez un appareil pour le sélectionner, appui long pour le déplacer.
      </p>
    </div>
  );
}

/** Contenu du panneau de droite (ou de la feuille mobile). */
export function PropertiesPanel({ onRequestClose, onMove }: { onRequestClose?: () => void; onMove?: () => void }) {
  const project = usePanelEditor((s) => s.project)!;
  const selection = usePanelEditor((s) => s.selection);
  const select = usePanelEditor((s) => s.select);
  if (selection?.kind === 'zone') {
    return (
      <LabelEditor
        leaderId={selection.id}
        onDone={() => {
          select(null);
          onRequestClose?.();
        }}
      />
    );
  }
  const device = selection?.kind === 'device' ? project.devices.find((d) => d.id === selection.id) : undefined;
  if (!device) return <BoardSummary />;
  const product = getProduct(device.productId);
  return (
    <div className="space-y-4 p-4" data-testid="device-properties">
      <SharedDefs uid="prop" />
      <div className="flex items-center gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100">{product && <DeviceThumb product={product} uid="prop" pxPerMm={product.modules > 2 ? 0.9 : 1.4} />}</span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-slate-900">{product?.shortName ?? 'Appareil'}</p>
          <p className="text-sm text-slate-600">{product?.fullName}</p>
          {device.label && <p className="mt-0.5 truncate text-sm font-semibold text-blue-700">« {device.label} »</p>}
        </div>
      </div>
      <DeviceActions device={device} onLabel={() => select({ kind: 'zone', id: zoneOf(project.devices, device.id, project.labelStyle)?.leaderId ?? device.id })} onMove={onMove} />
      <DeviceDetails device={device} />
    </div>
  );
}
