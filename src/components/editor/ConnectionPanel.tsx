import type { ConnectionType, DashStyle } from '../../types';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CONNECTION_TYPE_LABELS, DASH_LABELS } from '../../utils/connections';
import { Button } from '../ui/Button';
import { Segmented, Slider, Toggle } from '../ui/Field';
import { Trash2 } from 'lucide-react';

const COLORS = ['#f97316', '#2563eb', '#6b7280', '#dc2626', '#16a34a', '#7c3aed', '#111827'];

/** Propriétés d'une liaison : type, couleur, épaisseur, pointillés, courbure, numéro de commande. */
export function ConnectionPanel({ connectionId, onClose }: { connectionId: string; onClose?: () => void }) {
  const conn = useEditorStore((s) => s.doc.connections.find((c) => c.id === connectionId));
  const symbols = useEditorStore((s) => s.doc.symbols);
  const settings = useSettingsStore((s) => s.settings);
  if (!conn) return <p className="p-4 text-sm text-gray-500">Liaison introuvable.</p>;
  const st = useEditorStore.getState();
  const src = symbols.find((s) => s.id === conn.sourceId);
  const tgt = symbols.find((s) => s.id === conn.targetId);
  const update = st.updateConnection.bind(null, conn.id);
  /** Aperçu en direct pendant le glissement du curseur, une seule entrée d'historique à la fin. */
  const live = (changes: { width?: number; curvature?: number }) => {
    const s = useEditorStore.getState();
    if (!s.gestureStart) s.beginGesture();
    s.updateTransient((d) => ({ ...d, connections: d.connections.map((c) => (c.id === conn.id ? { ...c, ...changes } : c)) }));
  };
  const endLive = () => useEditorStore.getState().endGesture();

  const setType = (type: ConnectionType) => {
    const color = type === 'command' ? settings.commandColor : type === 'circuit' ? settings.circuitColor : settings.informationColor;
    const dash: DashStyle = type === 'circuit' ? 'long' : type === 'information' ? 'dot' : 'dash';
    update({ type, color, dash });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-gray-600">
        <strong>{src ? getSymbolDefinition(src.symbolType).name : '?'}</strong> → <strong>{tgt ? getSymbolDefinition(tgt.symbolType).name : '?'}</strong>
        <br />
        <span className="text-xs text-gray-500">Liaison logique (ne représente pas forcément le passage réel du câble).</span>
      </p>
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Type</p>
        <Segmented<ConnectionType>
          ariaLabel="Type de liaison"
          value={conn.type}
          onChange={setType}
          options={(Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[]).map((t) => ({ value: t, label: CONNECTION_TYPE_LABELS[t] }))}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Pointillés</p>
        <Segmented<DashStyle>
          ariaLabel="Style de pointillés"
          size="sm"
          value={conn.dash}
          onChange={(dash) => update({ dash })}
          options={(Object.keys(DASH_LABELS) as DashStyle[]).map((d) => ({ value: d, label: DASH_LABELS[d] }))}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Couleur</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              aria-pressed={conn.color === c}
              onClick={() => update({ color: c })}
              className={`size-11 rounded-xl border-2 ${conn.color === c ? 'border-ink-900' : 'border-white shadow'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <Slider label="Épaisseur" value={conn.width} min={1} max={8} step={0.5} onChange={(width) => live({ width })} onCommit={endLive} format={(v) => `${v}`} />
      <Slider
        label="Courbure"
        value={conn.curvature}
        min={-1}
        max={1}
        step={0.05}
        onChange={(curvature) => live({ curvature })}
        onCommit={endLive}
        format={(v) => v.toFixed(2)}
      />
      {conn.type === 'command' && (
        <>
          <Toggle label={`Afficher « Commande ${conn.group ?? '?'} »`} checked={Boolean(conn.showLabel)} onChange={(v) => update({ showLabel: v })} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">N° de commande</span>
            <Button size="sm" onClick={() => update({ group: Math.max(1, (conn.group ?? 1) - 1) })} aria-label="Numéro précédent">
              −
            </Button>
            <span className="w-8 text-center font-bold tabular-nums">{conn.group ?? '–'}</span>
            <Button size="sm" onClick={() => update({ group: (conn.group ?? 0) + 1 })} aria-label="Numéro suivant">
              +
            </Button>
          </div>
        </>
      )}
      <Button
        variant="danger"
        icon={<Trash2 className="size-4" aria-hidden />}
        onClick={() => {
          st.select('connection', [conn.id]);
          st.deleteSelection();
          onClose?.();
        }}
      >
        Supprimer la liaison
      </Button>
    </div>
  );
}
