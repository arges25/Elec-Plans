import type { ReactNode } from 'react';
import { AlignLeft, Copy, ExternalLink, Hash, LayoutGrid, Move, Pencil, Rows3, Tag, Trash2, Archive } from 'lucide-react';
import type { PlacedDevice } from '../types';
import { DEVICE_KIND_LABELS, brandName, getEnclosure, getProduct, listDevices, productRatingText, productVariants } from '../data/catalog';
import { DIN_MODULE_MM, NOT_PROVIDED, REFERENCE_NOT_PROVIDED } from '../constants';
import { devicesInRow, freeIntervals } from '../engine/placement';
import { formatPercent, occupancy, totalsRuleLabel } from '../engine/boardOps';
import { capacityOf, usePanelEditor } from '../store/panelEditorStore';
import { SharedDefs } from '../render/BoardDefs';
import { iconSvg } from '../render/icons';
import { DeviceThumb } from './DeviceThumb';
import { EnclosureInfo } from './EnclosureInfo';
import { placeOrAsk } from './dragStore';
import { useUiStore } from './uiStore';
import { toast } from '../../../store/toastStore';
import { confirmDialog } from '../../../store/dialogStore';

/** Panneau de propriétés : appareil sélectionné, emplacement libre ou tableau. */

function fmt(n: number): string {
  return String(n).replace('.', ',');
}

const fieldCls = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 py-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Nombre validé à la sortie du champ ou sur Entrée (pas à chaque frappe). */
function CommitNumber({ value, min, max, onCommit, label, testId }: { value: number; min: number; max: number; onCommit: (v: number) => void; label: string; testId?: string }) {
  const commit = (raw: string) => {
    const v = Math.round(Number(raw.replace(',', '.')) * 2) / 2;
    if (Number.isFinite(v) && v >= min && v <= max) onCommit(v);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      defaultValue={String(value).replace('.', ',')}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`${fieldCls} w-20`}
      aria-label={label}
      data-testid={testId}
    />
  );
}

function Info({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <Field label={label}>
      <span className={`block text-sm font-semibold ${muted ? 'font-normal text-amber-700' : 'text-slate-900'}`}>{children}</span>
    </Field>
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

function DeviceCard({ device, onMove }: { device: PlacedDevice; onMove?: () => void }) {
  const doc = usePanelEditor((s) => s.doc)!;
  const editor = usePanelEditor.getState;
  const product = getProduct(device.productId);
  const cap = capacityOf(doc);
  if (!product) return <p className="p-4 text-sm text-slate-500">Produit introuvable dans la base.</p>;
  const variants = productVariants(product.id);
  const rating = productRatingText(product);
  const coalesce = (f: string) => `dev-${device.id}-${f}`;
  const move = (row: number, start: number) => {
    placeOrAsk({ action: 'move', productId: device.productId, deviceId: device.id, row, start, width: device.moduleWidth });
  };

  return (
    <div className="space-y-4 p-4" data-testid="device-properties">
      <SharedDefs uid="prop" />
      <div className="flex items-center gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <DeviceThumb product={product} uid="prop" pxPerMm={product.modules > 2 ? 0.9 : 1.4} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-slate-900">
            {device.circuitRef && <span className="mr-1.5 rounded bg-slate-900 px-1.5 text-white">{device.circuitRef}</span>}
            {product.shortName}
          </p>
          <p className="text-sm text-slate-600">{product.fullName}</p>
          {device.label && <p className="mt-0.5 truncate text-sm font-semibold text-blue-700">{device.label}</p>}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(4.4rem,1fr))] gap-1.5">
        <ActionButton testId="action-edit" icon={<Pencil className="size-5" aria-hidden />} label="Modifier" onClick={() => useUiStore.getState().openQuickEdit(device.id, 'label')} />
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
        <ActionButton testId="action-label" icon={<Tag className="size-5" aria-hidden />} label="Étiquette" onClick={() => useUiStore.getState().openQuickEdit(device.id, 'label')} />
        <ActionButton testId="action-delete" icon={<Trash2 className="size-5" aria-hidden />} label="Supprimer" danger onClick={() => editor().removeDevice(device.id)} />
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-3 py-1">
        <Info label="Type">{DEVICE_KIND_LABELS[product.kind]}</Info>
        <Info label="Marque">{brandName(product.brand)}</Info>
        <Info label="Gamme">{product.family}</Info>
        <Info label="Référence" muted={!product.reference}>
          {product.reference ?? REFERENCE_NOT_PROVIDED}
        </Info>
        {variants.length > 1 ? (
          <Field label="Calibre">
            <select
              value={device.productId}
              onChange={(e) => {
                const r = editor().replaceProduct(device.id, e.target.value);
                if (!r.ok) toast.error(r.message ?? 'Modification impossible');
              }}
              className={fieldCls}
              aria-label="Calibre"
              data-testid="field-rating"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {productRatingText(v) ?? v.shortName}
                  {v.reference ? ` — ${v.reference}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          rating && <Info label="Calibre">{rating}</Info>
        )}
        {product.verified ? (
          <Info label="Largeur">
            {fmt(device.moduleWidth)} module{device.moduleWidth > 1 ? 's' : ''} ({fmt(device.moduleWidth * DIN_MODULE_MM)} mm)
          </Info>
        ) : (
          <Field label="Largeur">
            <div className="flex items-center gap-2">
              <CommitNumber
                key={`${device.id}-${device.moduleWidth}`}
                value={device.moduleWidth}
                min={0.5}
                max={cap.modulesPerRow}
                onCommit={(v) => {
                  if (v === device.moduleWidth) return;
                  const r = editor().resizeDevice(device.id, v);
                  if (!r.ok && r.message) toast.error(r.message);
                }}
                label="Largeur en modules"
              />
              <span className="text-xs text-slate-500">module(s) · à vérifier sur la fiche produit</span>
            </div>
          </Field>
        )}
        <Field label="Rangée">
          <select value={device.row} onChange={(e) => move(Number(e.target.value), device.startModule)} className={fieldCls} aria-label="Rangée" data-testid="field-row">
            {Array.from({ length: cap.rows }, (_, r) => (
              <option key={r} value={r}>
                {r + 1}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Position">
          <CommitNumber
            key={`${device.id}-${device.startModule}`}
            value={device.startModule + 1}
            min={1}
            max={cap.modulesPerRow}
            onCommit={(v) => v - 1 !== device.startModule && move(device.row, v - 1)}
            label="Position (module)"
            testId="field-position"
          />
        </Field>
        <Field label="Repère">
          <input value={device.circuitRef} onChange={(e) => editor().updateDevice(device.id, { circuitRef: e.target.value }, coalesce('ref'))} className={fieldCls} placeholder="ex. 7" aria-label="Repère" data-testid="field-ref" />
        </Field>
        <Field label="Étiquette">
          <input value={device.label} onChange={(e) => editor().updateDevice(device.id, { label: e.target.value }, coalesce('label'))} className={fieldCls} placeholder="ex. Four" aria-label="Étiquette" data-testid="field-label" />
        </Field>
        <Field label="Nom court">
          <input value={device.shortLabel} onChange={(e) => editor().updateDevice(device.id, { shortLabel: e.target.value }, coalesce('short'))} className={fieldCls} placeholder="facultatif" aria-label="Nom court" />
        </Field>
        <Field label="Icône">
          <button type="button" onClick={() => useUiStore.getState().openQuickEdit(device.id, 'label')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-sm hover:bg-slate-50">
            {device.icon ? <span className="inline-block size-6" dangerouslySetInnerHTML={{ __html: iconSvg(device.icon, 24, `pi-${device.id}`) }} /> : null}
            {device.icon ? 'Changer' : 'Aucune (facultatif)'}
          </button>
        </Field>
        <Info label="Source" muted={!product.sourceUrl}>
          {product.sourceUrl ? (
            <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline">
              {product.sourceName} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            'Non vérifiée'
          )}
        </Info>
        {!product.widthMm && product.verified && <Info label="Larg. physique" muted>{NOT_PROVIDED}</Info>}
      </div>
    </div>
  );
}

/** Emplacement libre sélectionné : réserver ou poser rapidement un appareil. */
function SlotCard({ row, start }: { row: number; start: number }) {
  const doc = usePanelEditor((s) => s.doc)!;
  const cap = capacityOf(doc);
  const interval = freeIntervals(doc.devices, cap, row).find(([a, b]) => start >= a - 1e-6 && start < b - 1e-6);
  const room = interval ? interval[1] - start : 0;
  const quick = listDevices(doc.brand).filter((p) => ['breaker-C-10', 'breaker-C-16', 'breaker-C-20', 'breaker-C-32', 'rcd-63-AC', 'rcd-63-A'].includes(p.equivalence) && p.modules <= room);
  const reserve = (width: number) => {
    const r = usePanelEditor.getState().reserveSlot(row, start, width);
    if (!r.ok) toast.error(r.message ?? 'Réservation impossible');
  };
  return (
    <div className="space-y-4 p-4" data-testid="slot-properties">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Emplacement libre</p>
        <p className="text-lg font-bold text-slate-900">
          Rangée {row + 1} · module {fmt(start + 1)}
        </p>
        <p className="text-sm text-slate-600">{fmt(room)} module(s) libre(s) à partir d’ici</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => reserve(1)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50" data-testid="reserve-slot">
          <Archive className="size-4" aria-hidden /> Réserver 1 module
        </button>
        {room >= 2 && (
          <button type="button" onClick={() => reserve(Math.floor(room))} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50">
            <Archive className="size-4" aria-hidden /> Réserver {fmt(Math.floor(room))} modules
          </button>
        )}
      </div>
      {quick.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-800">Poser ici</p>
          <div className="grid grid-cols-3 gap-1.5">
            {quick.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => placeOrAsk({ action: 'add', productId: p.id, row, start, width: p.modules })}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50"
              >
                {p.shortName}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Autres appareils : bibliothèque (glisser-déposer ou toucher puis poser).</p>
        </div>
      )}
    </div>
  );
}

function BoardSummary() {
  const doc = usePanelEditor((s) => s.doc)!;
  const enc = getEnclosure(doc.enclosureId);
  if (!enc) return null;
  const ed = usePanelEditor.getState;
  const cap = capacityOf(doc);
  const occ = occupancy(doc.devices, cap);
  const alert = doc.minFreePercent !== null && occ.freePercent + 1e-9 < doc.minFreePercent;
  const hasRefs = doc.devices.some((d) => d.circuitRef.trim());
  return (
    <div className="space-y-4 p-4" data-testid="board-summary">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Titre du tableau</span>
        <input value={doc.title} onChange={(e) => ed().setBoardMeta({ title: e.target.value })} className={`${fieldCls} font-bold uppercase`} aria-label="Titre du tableau" data-testid="board-title-input" />
      </label>

      <div className={`rounded-2xl border p-3 ${alert ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`} data-testid="occupancy-card">
        <p className="text-sm font-bold text-slate-900">
          {enc.rows} rangée{enc.rows > 1 ? 's' : ''} de {enc.modulesPerRow} modules · {occ.totalModules} modules
        </p>
        <p className="mt-0.5 text-sm text-slate-700">
          {fmt(occ.usedModules)} utilisés · <strong>{fmt(occ.freeModules)} libres</strong> ({formatPercent(occ.freePercent)})
          {occ.reservedModules ? ` · dont ${fmt(occ.reservedModules)} réservé${occ.reservedModules > 1 ? 's' : ''}` : ''}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full ${alert ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, (occ.usedModules / occ.totalModules) * 100)}%` }} />
        </div>
        <label className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-700">Réserve minimale souhaitée</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={doc.minFreePercent ?? ''}
              placeholder="—"
              onChange={(e) => ed().setBoardMeta({ minFreePercent: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))) })}
              className={`${fieldCls} w-20 text-right`}
              aria-label="Réserve minimale en pourcentage"
            />
            %
          </span>
        </label>
        {alert && <p className="mt-1 text-xs font-semibold text-red-700">Réserve de {doc.minFreePercent} % non respectée.</p>}
        {doc.minFreePercent === null && <p className="mt-1 text-xs text-slate-500">Aucune règle imposée : saisissez la réserve voulue pour être alerté.</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-bold text-slate-900">Totaux de rangée</p>
        <select
          value={doc.totals.kind}
          onChange={(e) => {
            const k = e.target.value;
            ed().setSettings({ totals: k === 'sum' ? { kind: 'sum' } : k === 'sum-coef' ? { kind: 'sum-coef', coef: doc.totals.kind === 'sum-coef' ? doc.totals.coef : 0.5 } : { kind: 'none' } });
          }}
          className={`${fieldCls} mt-2`}
          aria-label="Règle de calcul des totaux"
          data-testid="totals-rule"
        >
          <option value="none">Aucun calcul (informations connues seulement)</option>
          <option value="sum">Somme des calibres des disjoncteurs</option>
          <option value="sum-coef">Somme des calibres × coefficient</option>
        </select>
        {doc.totals.kind === 'sum-coef' && (
          <label className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-700">Coefficient</span>
            <input
              type="number"
              min={0.05}
              max={1}
              step={0.05}
              value={doc.totals.coef}
              onChange={(e) => ed().setSettings({ totals: { kind: 'sum-coef', coef: Math.max(0.05, Math.min(1, Number(e.target.value) || 0.5)) } })}
              className={`${fieldCls} w-24 text-right`}
              aria-label="Coefficient"
            />
          </label>
        )}
        <p className="mt-1.5 text-xs text-slate-500">
          {totalsRuleLabel(doc.totals)}. Règle choisie par vous : l’application n’en déduit aucune conformité.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!doc.devices.length}
          onClick={async () => {
            if (hasRefs && !(await confirmDialog({ title: 'Numéroter les circuits ?', message: 'Les repères des disjoncteurs seront remplacés par 1, 2, 3… (annulable).', confirmLabel: 'Numéroter' }))) return;
            ed().numberCircuits();
            toast.success('Circuits numérotés');
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
          data-testid="number-circuits"
        >
          <Hash className="size-4" aria-hidden /> Numéroter les circuits
        </button>
        <button
          type="button"
          disabled={!doc.devices.length}
          onClick={() => {
            const res = ed().autoArrange();
            if (!res.ok) toast.error(res.message ?? 'Organisation impossible');
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
        >
          <LayoutGrid className="size-4" aria-hidden /> Organisation auto
        </button>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
        Numéros de modules (1 à {enc.modulesPerRow})
        <input type="checkbox" checked={doc.showModuleNumbers} onChange={(e) => ed().setSettings({ showModuleNumbers: e.target.checked })} className="size-5 accent-blue-600" />
      </label>

      <div className="space-y-2">
        {Array.from({ length: cap.rows }, (_, r) => {
          const ro = occupancy(doc.devices, cap, r);
          const count = devicesInRow(doc.devices, r).length;
          return (
            <div key={r} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-bold">Rangée {r + 1}</span>
                <span className={`text-xs font-semibold ${ro.freeModules <= 0 ? 'text-red-600' : 'text-slate-500'}`}>{ro.freeModules <= 0 ? 'Rangée complète' : `${fmt(ro.freeModules)} libre(s)`}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={!count}
                  onClick={() => {
                    const res = ed().duplicateRow(r);
                    if (!res.ok) toast.error(res.message ?? 'Duplication impossible');
                  }}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Rows3 className="size-3.5" aria-hidden /> Dupliquer
                </button>
                <button
                  type="button"
                  disabled={!count}
                  onClick={() => ed().compactRow(r)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  data-testid={`compact-row-${r}`}
                >
                  <AlignLeft className="size-3.5" aria-hidden /> Compacter
                </button>
                <button
                  type="button"
                  disabled={!count}
                  onClick={async () => {
                    if (await confirmDialog({ title: `Vider la rangée ${r + 1} ?`, message: `${count} appareil(s) seront retirés (annulable).`, confirmLabel: 'Vider', danger: true })) ed().clearRow(r);
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
      <EnclosureInfo enclosure={enc} />
    </div>
  );
}

/** Contenu du panneau de droite (ou de la feuille mobile). */
export function PropertiesPanel({ onMove }: { onMove?: () => void }) {
  const doc = usePanelEditor((s) => s.doc)!;
  const selection = usePanelEditor((s) => s.selection);
  if (selection?.kind === 'slot') return <SlotCard row={selection.row} start={selection.start} />;
  const id = selection && 'id' in selection ? selection.id : null;
  const device = id ? doc.devices.find((d) => d.id === id) : undefined;
  if (!device) return <BoardSummary />;
  return <DeviceCard device={device} onMove={onMove} />;
}
