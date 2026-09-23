import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CircuitKind, ElectricalCircuit, PanelRow } from '../../types';
import { LABEL_ICON_CHOICES, guessCircuitIcon } from '../../data/labelIcons';
import { CIRCUIT_KIND_LABELS } from '../../services/panelCircuits';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { SymbolIcon } from '../symbols/SymbolIcon';

const PROTECTIONS = ['C2', 'C10', 'C16', 'C20', 'C32', 'C40', '40A 30mA', '63A 30mA', '15/45A', '30/60A'];
const SECTIONS = ['1,5 mm²', '2,5 mm²', '4 mm²', '6 mm²', '10 mm²', '16 mm²'];

export interface CircuitEditorSheetProps {
  circuit: ElectricalCircuit | null;
  rows: PanelRow[];
  isNew: boolean;
  symbolCount?: number;
  onSave: (c: ElectricalCircuit) => void;
  onDelete: (c: ElectricalCircuit) => void;
  onClose: () => void;
}

/** Édition d'un circuit du tableau (numéro, nom, protection, section, modules, pictogramme). */
export function CircuitEditorSheet({ circuit, rows, isNew, symbolCount, onSave, onDelete, onClose }: CircuitEditorSheetProps) {
  const [c, setC] = useState<ElectricalCircuit | null>(circuit);
  const [iconTouched, setIconTouched] = useState(false);
  useEffect(() => {
    setC(circuit);
    setIconTouched(!isNew);
  }, [circuit, isNew]);
  if (!c) return null;
  const set = <K extends keyof ElectricalCircuit>(k: K, v: ElectricalCircuit[K]) => setC((x) => (x ? { ...x, [k]: v } : x));

  return (
    <Sheet
      open={Boolean(circuit)}
      onClose={onClose}
      title={isNew ? 'Nouveau circuit' : `Circuit ${c.number || ''}`.trim()}
      desktop="center"
      mobileHeight="full"
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => onDelete(c)}>
              Supprimer
            </Button>
          )}
          <Button variant="primary" block onClick={() => onSave({ ...c, name: c.name.trim() || 'Circuit' })}>
            {isNew ? 'Ajouter le circuit' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <SelectField
          label="Type"
          value={c.kind}
          onValueChange={(v) => {
            const kind = v as CircuitKind;
            setC((x) =>
              x
                ? {
                    ...x,
                    kind,
                    modules: kind === 'differential' || kind === 'main' ? Math.max(2, x.modules) : x.modules,
                    icon: kind === 'differential' && !iconTouched ? 'interrupteur-differentiel' : x.icon,
                  }
                : x,
            );
          }}
          options={(Object.keys(CIRCUIT_KIND_LABELS) as CircuitKind[]).map((k) => ({ value: k, label: CIRCUIT_KIND_LABELS[k] }))}
        />
        <div className="grid grid-cols-[88px_1fr] gap-3">
          <TextField label="N°" value={c.number} onValueChange={(v) => set('number', v)} inputMode="numeric" />
          <TextField
            label="Nom (texte de l’étiquette)"
            value={c.name}
            placeholder="Éclairage salon"
            onValueChange={(v) => {
              setC((x) => (x ? { ...x, name: v, icon: iconTouched ? x.icon : (guessCircuitIcon(v) ?? x.icon) } : x));
            }}
            autoFocus={isNew}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <TextField label="Protection" value={c.protection} list="prot-list" onValueChange={(v) => set('protection', v)} placeholder="C16" />
            <datalist id="prot-list">
              {PROTECTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <TextField label="Section câble" value={c.cableSection} list="sect-list" onValueChange={(v) => set('cableSection', v)} placeholder="2,5 mm²" />
            <datalist id="sect-list">
              {SECTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Rangée" value={c.rowId} onValueChange={(v) => set('rowId', v)} options={rows.map((r) => ({ value: r.id, label: r.name }))} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-700">Largeur (modules)</span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => set('modules', Math.max(1, c.modules - 1))} aria-label="Moins de modules">
                −
              </Button>
              <span className="w-8 text-center text-lg font-bold tabular-nums">{c.modules}</span>
              <Button size="sm" onClick={() => set('modules', Math.min(8, c.modules + 1))} aria-label="Plus de modules">
                +
              </Button>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Pictogramme de l’étiquette</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            <button
              type="button"
              onClick={() => {
                set('icon', undefined);
                setIconTouched(true);
              }}
              className={`flex min-h-14 items-center justify-center rounded-xl border text-xs font-semibold ${!c.icon ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
            >
              Aucun
            </button>
            {LABEL_ICON_CHOICES.map((ic) => (
              <button
                key={ic.symbolId}
                type="button"
                title={ic.label}
                aria-label={ic.label}
                aria-pressed={c.icon === ic.symbolId}
                onClick={() => {
                  set('icon', ic.symbolId);
                  setIconTouched(true);
                }}
                className={`flex min-h-14 items-center justify-center rounded-xl border ${c.icon === ic.symbolId ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
              >
                <SymbolIcon id={ic.symbolId} size={32} color="#111827" />
              </button>
            ))}
          </div>
        </div>
        {symbolCount !== undefined && symbolCount > 0 && <p className="text-sm text-gray-600">{symbolCount} symbole(s) du plan relié(s) à ce circuit.</p>}
      </div>
    </Sheet>
  );
}
