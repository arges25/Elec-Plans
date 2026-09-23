import type { ReactNode } from 'react';
import { Cable, Check, Copy, FlipHorizontal2, Minus, Pencil, Plus, RefreshCw, RotateCw, Settings2, Trash2, X } from 'lucide-react';
import type { ConnectionType } from '../../types';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { docOps, useEditorStore } from '../../store/editorStore';
import { promptDialog } from '../../store/dialogStore';
import { SymbolIcon } from '../symbols/SymbolIcon';
import { Segmented, Toggle } from '../ui/Field';
import { renameRoom } from './konva/PlanLayers';
import { toolDef } from './toolDefs';
import { clampOpeningT } from '../../utils/openings';

function Action({ label, icon, onClick, danger, primary }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-h-12 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : primary ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-gray-800 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

const Bar = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white/95 p-1 shadow-xl backdrop-blur no-scrollbar animate-pop-in">
    {children}
  </div>
);

/** Menu contextuel de la sélection : Tourner, +1, Relier, Propriétés, Supprimer… */
export function SelectionMenu({ onProperties }: { onProperties: () => void }) {
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const doc = useEditorStore((s) => s.doc);
  if (!selection || tool !== 'select') return null;
  const st = useEditorStore.getState();
  const single = selection.ids.length === 1 ? selection.ids[0] : null;
  const del = <Action label="Supprimer" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => st.deleteSelection()} danger />;
  const I = 'size-5';

  switch (selection.kind) {
    case 'symbol':
      return (
        <Bar>
          {single && <SymbolIcon id={doc.symbols.find((s) => s.id === single)?.symbolType ?? ''} size={30} className="mx-1" />}
          <Action label="Tourner" icon={<RotateCw className={I} aria-hidden />} onClick={() => st.rotateSelection(90)} />
          <Action label="+1" icon={<Copy className={I} aria-hidden />} onClick={() => st.duplicateSelection(20)} />
          {single && (
            <Action
              label="Relier"
              icon={<Cable className={I} aria-hidden />}
              onClick={() => {
                st.setTool('connect');
                st.setConnectSource(single);
              }}
            />
          )}
          {single && <Action label="Propriétés" icon={<Settings2 className={I} aria-hidden />} onClick={onProperties} />}
          {del}
        </Bar>
      );
    case 'wall': {
      const wall = single ? doc.walls.find((w) => w.id === single) : undefined;
      return (
        <Bar>
          {wall && (
            <>
              <Action label="Plus fin" icon={<Minus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchWall(wall.id, { thickness: Math.max(2, wall.thickness - 2) }))} />
              <span className="px-1 text-xs font-bold tabular-nums text-gray-600">{Math.round(wall.thickness)}</span>
              <Action label="Plus épais" icon={<Plus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchWall(wall.id, { thickness: Math.min(60, wall.thickness + 2) }))} />
            </>
          )}
          <Action label="Dupliquer" icon={<Copy className={I} aria-hidden />} onClick={() => st.duplicateSelection(20)} />
          {del}
        </Bar>
      );
    }
    case 'door': {
      const door = single ? doc.doors.find((d) => d.id === single) : undefined;
      const wall = door ? doc.walls.find((w) => w.id === door.wallId) : undefined;
      if (!door || !wall) return <Bar>{del}</Bar>;
      const resize = (k: number) => {
        const width = Math.max(20, door.width * k);
        st.commit(docOps.patchDoor(door.id, { width, t: clampOpeningT(wall, door.t, width) }));
      };
      return (
        <Bar>
          <Action label="Plus étroite" icon={<Minus className={I} aria-hidden />} onClick={() => resize(1 / 1.1)} />
          <Action label="Plus large" icon={<Plus className={I} aria-hidden />} onClick={() => resize(1.1)} />
          <Action label="Sens" icon={<FlipHorizontal2 className={I} aria-hidden />} onClick={() => st.commit(docOps.patchDoor(door.id, { flip: !door.flip }))} />
          <Action label="Charnière" icon={<RefreshCw className={I} aria-hidden />} onClick={() => st.commit(docOps.patchDoor(door.id, { hingeEnd: !door.hingeEnd }))} />
          {del}
        </Bar>
      );
    }
    case 'window': {
      const win = single ? doc.windows.find((d) => d.id === single) : undefined;
      if (!win) return <Bar>{del}</Bar>;
      return (
        <Bar>
          <Action label="Plus étroite" icon={<Minus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchWindow(win.id, { width: Math.max(20, win.width / 1.1) }))} />
          <Action label="Plus large" icon={<Plus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchWindow(win.id, { width: win.width * 1.1 }))} />
          {del}
        </Bar>
      );
    }
    case 'room': {
      const room = single ? doc.rooms.find((r) => r.id === single) : undefined;
      return (
        <Bar>
          {room && <Action label="Renommer" icon={<Pencil className={I} aria-hidden />} onClick={() => void renameRoom(room)} />}
          {del}
        </Bar>
      );
    }
    case 'annotation': {
      const a = single ? doc.annotations.find((x) => x.id === single) : undefined;
      return (
        <Bar>
          {a?.kind === 'text' && (
            <Action
              label="Modifier"
              icon={<Pencil className={I} aria-hidden />}
              onClick={async () => {
                const text = await promptDialog({ title: 'Modifier le texte', defaultValue: a.text ?? '', label: 'Texte' });
                if (text?.trim()) st.commit(docOps.patchAnnotation(a.id, { text: text.trim() }));
              }}
            />
          )}
          {a?.kind === 'text' && (
            <>
              <Action label="Plus petit" icon={<Minus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchAnnotation(a.id, { fontSize: Math.max(8, (a.fontSize ?? 22) / 1.15) }))} />
              <Action label="Plus grand" icon={<Plus className={I} aria-hidden />} onClick={() => st.commit(docOps.patchAnnotation(a.id, { fontSize: (a.fontSize ?? 22) * 1.15 }))} />
            </>
          )}
          <Action label="+1" icon={<Copy className={I} aria-hidden />} onClick={() => st.duplicateSelection(20)} />
          {del}
        </Bar>
      );
    }
    case 'connection':
      return (
        <Bar>
          <Action label="Propriétés" icon={<Settings2 className={I} aria-hidden />} onClick={() => st.openSheet('connection')} />
          {del}
        </Bar>
      );
    case 'measure':
      return <Bar>{del}</Bar>;
  }
}

/** Barre du mode « placer » (mode répétition / placer plusieurs). */
export function PlaceModeBar() {
  const placeSymbolId = useEditorStore((s) => s.placeSymbolId);
  const repeat = useEditorStore((s) => s.repeat);
  const count = useEditorStore((s) => s.doc.symbols.filter((x) => x.symbolType === s.placeSymbolId).length);
  if (!placeSymbolId) return null;
  const def = getSymbolDefinition(placeSymbolId);
  const st = useEditorStore.getState();
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-1 rounded-2xl border border-brand-300 bg-white/95 p-2 shadow-xl backdrop-blur animate-pop-in">
      <div className="flex items-center gap-2">
        <SymbolIcon id={placeSymbolId} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">{def.name}</p>
          <p className="text-xs text-gray-600">Touchez le plan pour placer · {count} sur ce plan</p>
        </div>
        <button type="button" onClick={() => st.setTool('select')} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-green-600 px-4 font-bold text-white hover:bg-green-700">
          <Check className="size-5" aria-hidden /> TERMINER
        </button>
      </div>
      <div className="px-1">
        <Toggle label="Placer plusieurs (mode répétition)" checked={repeat} onChange={(v) => st.setRepeat(v)} />
      </div>
    </div>
  );
}

/** Barre du mode « relier ». */
export function ConnectModeBar() {
  const connectType = useEditorStore((s) => s.connectType);
  const sourceId = useEditorStore((s) => s.connectSourceId);
  const source = useEditorStore((s) => s.doc.symbols.find((x) => x.id === s.connectSourceId));
  const st = useEditorStore.getState();
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-brand-300 bg-white/95 p-2 shadow-xl backdrop-blur animate-pop-in">
      <div className="flex items-center gap-2">
        <Cable className="size-6 shrink-0 text-brand-500" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-gray-800">
          {source ? (
            <>
              Source : <strong>{getSymbolDefinition(source.symbolType).name}</strong> — touchez les éléments à relier
            </>
          ) : (
            <>Touchez la <strong>commande</strong> (interrupteur, poussoir…) puis l’éclairage.</>
          )}
        </p>
        {sourceId && (
          <button type="button" aria-label="Nouvelle source" onClick={() => st.setConnectSource(null)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-gray-300 px-2 text-xs font-semibold">
            <X className="size-4" aria-hidden /> Source
          </button>
        )}
        <button type="button" onClick={() => st.setTool('select')} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-green-600 px-3 font-bold text-white hover:bg-green-700">
          <Check className="size-5" aria-hidden /> TERMINER
        </button>
      </div>
      <Segmented<ConnectionType>
        ariaLabel="Type de liaison"
        size="sm"
        value={connectType}
        onChange={(t) => st.setConnectType(t)}
        options={[
          { value: 'command', label: <span className="text-brand-600">Commande</span> },
          { value: 'circuit', label: <span className="text-blue-600">Circuit</span> },
          { value: 'information', label: <span className="text-gray-600">Information</span> },
        ]}
      />
    </div>
  );
}

/** Rappel de l'outil actif (murs, annotations, mesures…). */
export function ToolHintBar() {
  const tool = useEditorStore((s) => s.tool);
  const def = toolDef(tool);
  if (!def || tool === 'select' || tool === 'connect' || tool === 'place') return null;
  return (
    <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-2 pl-3 shadow-xl backdrop-blur animate-pop-in">
      <span className="text-brand-600">{def.icon}</span>
      <p className="min-w-0 flex-1 text-sm text-gray-800">
        <strong>{def.label} :</strong> {def.hint}
      </p>
      <button type="button" onClick={() => useEditorStore.getState().setTool('select')} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-green-600 px-3 font-bold text-white hover:bg-green-700">
        <Check className="size-5" aria-hidden /> TERMINER
      </button>
    </div>
  );
}
