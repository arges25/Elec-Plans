import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cable, Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import type { ElectricalCircuit, PlacedSymbol, PlacedSymbolProperties } from '../../types';
import { categoryLabel, getSymbolDefinition } from '../../data/electricalSymbols';
import { db } from '../../database/db';
import { getOrCreateProjectPanel, saveCircuit } from '../../database/panelRepository';
import { useEditorStore } from '../../store/editorStore';
import { promptDialog } from '../../store/dialogStore';
import { toast } from '../../store/toastStore';
import { guessCircuitIcon } from '../../data/labelIcons';
import { createId } from '../../utils/id';
import { SymbolIcon } from '../symbols/SymbolIcon';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Field';
import { Badge } from '../ui/Card';

const BREAKERS = ['C2', 'C10', 'C16', 'C20', 'C32', 'C40', '10A', '16A', '20A', '32A'];
const SECTIONS = ['1,5 mm²', '2,5 mm²', '4 mm²', '6 mm²', '10 mm²', '16 mm²'];
const COLORS = ['#1d4ed8', '#0f766e', '#b45309', '#dc2626', '#7c3aed', '#15803d', '#111827', '#f97316'];

/** Champ texte validé à la sortie du champ (une seule entrée dans l'historique). */
function LazyText({
  label,
  value,
  onCommit,
  placeholder,
  list,
  multiline,
  inputMode,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  list?: string[];
  multiline?: boolean;
  inputMode?: 'text' | 'numeric';
}) {
  const [v, setV] = useState(value);
  const id = useId();
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  const cls =
    'w-full min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className={`${cls} min-h-20`} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input
          id={id}
          className={cls}
          value={v}
          placeholder={placeholder}
          inputMode={inputMode}
          list={list ? `${id}-list` : undefined}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
      {list && (
        <datalist id={`${id}-list`}>
          {list.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function PropertiesPanel({ symbolId, onClose }: { symbolId: string; onClose?: () => void }) {
  const symbol = useEditorStore((s) => s.doc.symbols.find((x) => x.id === symbolId));
  const rooms = useEditorStore((s) => s.doc.rooms);
  const allSymbols = useEditorStore((s) => s.doc.symbols);
  const projectId = useEditorStore((s) => s.projectId);
  const panel = useLiveQuery(() => (projectId ? db.panels.where('projectId').equals(projectId).first() : undefined), [projectId]);
  const circuits = useLiveQuery(() => (panel ? db.circuits.where('panelId').equals(panel.id).sortBy('order') : []), [panel?.id]) ?? [];
  const [rotation, setRotation] = useState(symbol?.rotation ?? 0);
  const [scale, setScale] = useState(symbol?.scale ?? 1);

  useEffect(() => {
    if (symbol) {
      setRotation(symbol.rotation);
      setScale(symbol.scale);
    }
  }, [symbol]);

  const roomNames = useMemo(() => {
    const set = new Set<string>(rooms.map((r) => r.name));
    for (const s of allSymbols) if (s.properties.room) set.add(s.properties.room);
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rooms, allSymbols]);

  if (!symbol) return <p className="p-4 text-sm text-gray-500">Aucun symbole sélectionné.</p>;
  const def = getSymbolDefinition(symbol.symbolType);
  const st = useEditorStore.getState();

  const setProps = (changes: Partial<PlacedSymbolProperties>) => st.updateSymbol(symbol.id, { properties: { ...symbol.properties, ...changes } });
  const update = (changes: Partial<PlacedSymbol>) => st.updateSymbol(symbol.id, changes);

  const assignCircuit = (c: ElectricalCircuit | null) => {
    if (!c) {
      setProps({ circuitId: undefined, circuitName: undefined, circuitNumber: undefined });
      return;
    }
    setProps({
      circuitId: c.id,
      circuitName: c.name,
      circuitNumber: c.number,
      breaker: c.protection || symbol.properties.breaker,
      cableSection: c.cableSection || symbol.properties.cableSection,
    });
  };

  const createCircuit = async () => {
    if (!projectId) return;
    const name = await promptDialog({
      title: 'Nouveau circuit',
      label: 'Nom du circuit',
      placeholder: 'Prises cuisine',
      defaultValue: symbol.properties.room ? `${def.role === 'light' ? 'Éclairage' : 'Prises'} ${symbol.properties.room.toLowerCase()}` : '',
    });
    if (!name?.trim()) return;
    const p = panel ?? (await getOrCreateProjectPanel(projectId));
    const existing = await db.circuits.where('panelId').equals(p.id).toArray();
    const maxNum = existing.reduce((m, c) => Math.max(m, Number.parseInt(c.number, 10) || 0), 0);
    const row = p.rows[p.rows.length - 1] ?? p.rows[0];
    const circuit: ElectricalCircuit = {
      id: createId('cir'),
      panelId: p.id,
      rowId: row.id,
      order: existing.length,
      number: String(maxNum + 1),
      name: name.trim(),
      kind: 'circuit',
      modules: 1,
      protection: def.role === 'light' ? 'C10' : 'C16',
      cableSection: def.role === 'light' ? '1,5 mm²' : '2,5 mm²',
      icon: guessCircuitIcon(name) ?? (def.role === 'light' ? 'point-lumineux' : 'prise-16a'),
    };
    await saveCircuit(circuit);
    assignCircuit(circuit);
    toast.success('Circuit créé ✓');
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
          <SymbolIcon id={def.id} size={48} color={symbol.properties.color} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{def.name}</p>
          <Badge>{categoryLabel(def.category)}</Badge>
          <p className="mt-1 text-xs text-gray-500">{def.description}</p>
        </div>
      </div>

      <LazyText
        label="Nom affiché sur le plan"
        value={symbol.properties.label ?? ''}
        placeholder="ex. Four, Lave-vaisselle"
        onCommit={(v) => setProps({ label: v.trim() || undefined })}
      />
      <LazyText
        label="Pièce"
        value={symbol.properties.room ?? ''}
        placeholder="ex. Cuisine"
        list={roomNames}
        onCommit={(v) => setProps({ room: v.trim() || undefined })}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="prop-circuit" className="text-sm font-semibold text-gray-700">
          Circuit
        </label>
        <select
          id="prop-circuit"
          className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3"
          value={symbol.properties.circuitId ?? ''}
          onChange={(e) => {
            if (e.target.value === '__new') void createCircuit();
            else assignCircuit(circuits.find((c) => c.id === e.target.value) ?? null);
          }}
        >
          <option value="">— Aucun circuit —</option>
          {circuits
            .filter((c) => c.kind === 'circuit')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.number ? `${c.number} · ` : ''}
                {c.name}
              </option>
            ))}
          <option value="__new">+ Nouveau circuit…</option>
        </select>
        {!symbol.properties.circuitId && (
          <LazyText
            label="Nom du circuit (libre)"
            value={symbol.properties.circuitName ?? ''}
            placeholder="ex. Prises cuisine"
            onCommit={(v) => setProps({ circuitName: v.trim() || undefined })}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LazyText
          label="Numéro circuit"
          value={symbol.properties.circuitNumber ?? ''}
          placeholder="ex. 3"
          onCommit={(v) => setProps({ circuitNumber: v.trim() || undefined })}
        />
        <LazyText
          label="Disjoncteur"
          value={symbol.properties.breaker ?? ''}
          placeholder="ex. C16"
          list={BREAKERS}
          onCommit={(v) => setProps({ breaker: v.trim() || undefined })}
        />
        <LazyText
          label="Section câble"
          value={symbol.properties.cableSection ?? ''}
          placeholder="ex. 2,5 mm²"
          list={SECTIONS}
          onCommit={(v) => setProps({ cableSection: v.trim() || undefined })}
        />
        <LazyText
          label="Hauteur (cm)"
          value={symbol.properties.heightCm !== undefined ? String(symbol.properties.heightCm) : ''}
          placeholder="ex. 110"
          inputMode="numeric"
          onCommit={(v) => {
            const n = Number.parseFloat(v.replace(',', '.'));
            setProps({ heightCm: Number.isFinite(n) ? n : undefined });
          }}
        />
      </div>
      <LazyText
        label="Commentaire"
        value={symbol.properties.comment ?? ''}
        placeholder="ex. Prévoir boîte profonde"
        multiline
        onCommit={(v) => setProps({ comment: v.trim() || undefined })}
      />

      <div>
        <Slider
          label="Rotation"
          value={rotation}
          min={0}
          max={359}
          step={1}
          onChange={setRotation}
          onCommit={(v) => update({ rotation: v })}
          format={(v) => `${Math.round(v)}°`}
        />
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => update({ rotation: (symbol.rotation + 270) % 360 })}>
            -90°
          </Button>
          <Button size="sm" icon={<RotateCw className="size-4" aria-hidden />} onClick={() => update({ rotation: (symbol.rotation + 90) % 360 })}>
            +90°
          </Button>
        </div>
      </div>
      <Slider
        label="Taille"
        value={scale}
        min={0.4}
        max={3}
        step={0.05}
        onChange={setScale}
        onCommit={(v) => update({ scale: v })}
        format={(v) => `${Math.round(v * 100)} %`}
      />

      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Couleur</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProps({ color: undefined })}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${!symbol.properties.color ? 'border-brand-500 bg-brand-50' : 'border-gray-300'}`}
          >
            Par défaut
          </button>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              aria-pressed={symbol.properties.color === c}
              onClick={() => setProps({ color: c })}
              className={`size-11 rounded-xl border-2 ${symbol.properties.color === c ? 'border-ink-900' : 'border-white shadow'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
        <Button size="sm" icon={<Copy className="size-4" aria-hidden />} onClick={() => st.duplicateSelection()}>
          Dupliquer
        </Button>
        <Button
          size="sm"
          icon={<Cable className="size-4" aria-hidden />}
          onClick={() => {
            st.setTool('connect');
            st.setConnectSource(symbol.id);
            st.openSheet(null);
            onClose?.();
          }}
        >
          Relier
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 className="size-4" aria-hidden />}
          onClick={() => {
            st.select('symbol', [symbol.id]);
            st.deleteSelection();
            onClose?.();
          }}
        >
          Supprimer
        </Button>
      </div>
    </div>
  );
}
