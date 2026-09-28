import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Copy,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { ElectricalCircuit, Label, PanelTemplate, TextAlign } from '../types';
import { usePanelLabels } from '../hooks/usePanelLabels';
import { useIsTablet } from '../hooks/useMediaQuery';
import { savePanel } from '../database/panelRepository';
import { AppHeader } from '../components/layout/AppHeader';
import { LabelStripView } from '../components/labels/LabelStripView';
import { LabelPrintPanel } from '../components/labels/LabelPrintPanel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import { Segmented, SelectField, Toggle } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';
import { Sheet } from '../components/ui/Sheet';
import { Stepper } from '../components/ui/Stepper';
import { SymbolIcon } from '../components/symbols/SymbolIcon';
import { LABEL_ICON_CHOICES } from '../data/labelIcons';
import { builtinTemplate } from '../data/electricalPanelTemplates';
import { IDENTITY } from '../services/labels/labelRender';
import {
  addCase,
  addLine,
  addLines,
  duplicateLine,
  removeCase,
  removeLine,
  renameLine,
  resetBuiltinTemplate,
  restoreCase,
  setCaseIcon,
  setCaseModules,
  setCaseNumber,
  setCaseText,
  shiftCase,
  updateTemplateSettings,
} from '../services/labels/labelEditorService';
import { buildLabelStrips, type LabelCell } from '../utils/labelLayout';
import { rowCases, usedModules, type TemplateDims } from '../utils/labelEditor';
import { confirmDialog, promptDialog } from '../store/dialogStore';
import { toast, useToastStore } from '../store/toastStore';

const BRANDS = ['Legrand', 'Schneider', 'Hager'] as const;
const MAX_LINES = 8;

/**
 * ÉTIQUETTES DU TABLEAU — éditeur simple et visuel :
 * à gauche les réglages (tableau, dimensions, texte, cases), à droite l'aperçu en direct.
 * Sur téléphone, l'aperçu reste visible en haut de l'écran pendant la saisie.
 */
export default function LabelsPage() {
  const { panelId } = useParams();
  const navigate = useNavigate();
  const { panel, circuits, labels, templates, template, printers, printer, project } = usePanelLabels(panelId);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [large, setLarge] = useState(false);
  /** Saisie en cours sur téléphone : aperçu compact (ligne de la case + zoom) pour laisser la place au clavier. */
  const [typing, setTyping] = useState(false);
  const tablet = useIsTablet();
  const caseRefs = useRef(new Map<string, HTMLDivElement>());
  const timers = useRef(new Map<string, number>());
  const latest = useRef({ drafts, circuits, labels });
  latest.current = { drafts, circuits, labels };

  // Texte en cours de saisie : l'aperçu l'affiche immédiatement, l'enregistrement suit.
  const effCircuits = useMemo(() => circuits.map((c) => (drafts[c.id] !== undefined ? { ...c, name: drafts[c.id] } : c)), [circuits, drafts]);
  const effLabels = useMemo(() => labels.map((l) => (drafts[l.circuitId] !== undefined ? { ...l, text: undefined } : l)), [labels, drafts]);
  const strips = useMemo(
    () => (panel && template ? buildLabelStrips(panel.rows, effCircuits, effLabels, template) : []),
    [panel, template, effCircuits, effLabels],
  );

  const flushText = useCallback(async (id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    const { drafts: d, circuits: cs, labels: ls } = latest.current;
    const text = d[id];
    const c = cs.find((x) => x.id === id);
    if (text === undefined || !c) return;
    await setCaseText(
      c,
      ls.find((l) => l.circuitId === id),
      text,
    );
  }, []);

  // Brouillon retiré une fois enregistré (évite tout clignotement du champ)
  useEffect(() => {
    setDrafts((d) => {
      let changed = false;
      const next = { ...d };
      for (const [id, text] of Object.entries(d)) {
        const c = circuits.find((x) => x.id === id);
        if (!c || (c.name === text && !timers.current.has(id) && !labels.some((l) => l.circuitId === id && l.text !== undefined))) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : d;
    });
  }, [circuits, labels]);

  // Enregistre les saisies en attente en quittant la page
  useEffect(
    () => () => {
      for (const id of [...timers.current.keys()]) void flushText(id);
    },
    [flushText],
  );

  if (!panel || !template) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="Étiquettes tableau" back="/labels" />
      </div>
    );
  }

  const name = project?.name ?? panel.name;
  const cal = printer?.calibration ?? IDENTITY;
  const labelFor = (id: string) => labels.find((l) => l.circuitId === id);
  const textOf = (c: ElectricalCircuit) => drafts[c.id] ?? labelFor(c.id)?.text ?? c.name;
  const cellById = new Map<string, LabelCell>(strips.flatMap((s) => s.cells.map((cell) => [cell.circuitId, cell] as [string, LabelCell])));
  const brand = template.brand;
  const brandTemplates = templates.filter((t) => t.brand === brand);
  const original = builtinTemplate(template.id);
  const modified =
    original &&
    (['modulesPerRow', 'modulePitchMm', 'labelHeightMm', 'fontSizePt', 'textAlign', 'showIcon', 'showNumber', 'maxLines'] as (keyof PanelTemplate)[]).some(
      (k) => original[k] !== template[k],
    );

  const setTpl = (changes: TemplateDims) => void updateTemplateSettings(template, changes);

  const pickBrand = (b: string) => {
    const list = templates.filter((t) => t.brand === b);
    const next = list.find((t) => t.modulesPerRow === template.modulesPerRow) ?? list[0];
    if (next && next.id !== panel.templateId) void savePanel({ ...panel, templateId: next.id });
  };

  const onText = (c: ElectricalCircuit, text: string) => {
    setDrafts((d) => ({ ...d, [c.id]: text }));
    latest.current.drafts = { ...latest.current.drafts, [c.id]: text };
    const t = timers.current.get(c.id);
    if (t) window.clearTimeout(t);
    timers.current.set(
      c.id,
      window.setTimeout(() => void flushText(c.id), 450),
    );
  };

  const select = (id: string, focus = false) => {
    setSelected(id);
    const el = caseRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focus) el.querySelector<HTMLInputElement>('input[data-case-text]')?.focus({ preventScroll: true });
    }
  };

  const newCase = async (rowId: string) => {
    const c = await addCase(panel, rowId, circuits);
    setSelected(c.id);
    // Le champ texte apparaît au prochain rendu : on le sélectionne pour une saisie directe
    window.setTimeout(() => {
      const el = caseRefs.current.get(c.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el?.querySelector<HTMLInputElement>('input[data-case-text]');
      input?.focus({ preventScroll: true });
      input?.select();
    }, 120);
  };

  const deleteCase = async (c: ElectricalCircuit) => {
    const saved = await removeCase(c);
    if (selected === c.id) setSelected(null);
    useToastStore
      .getState()
      .push({ kind: 'info', message: `Case « ${c.name || c.number} » supprimée`, action: { label: 'Annuler', onClick: () => void restoreCase(saved) } }, 5000);
  };

  const setLineCount = async (n: number) => {
    const count = Math.max(1, Math.min(MAX_LINES, Math.round(n)));
    if (count > panel.rows.length) await addLines(panel, count - panel.rows.length);
    else if (count < panel.rows.length) await deleteLine(panel.rows[panel.rows.length - 1].id);
  };

  const deleteLine = async (rowId: string) => {
    if (panel.rows.length <= 1) {
      toast.info('Il faut au moins une ligne');
      return;
    }
    const idx = panel.rows.findIndex((r) => r.id === rowId);
    const inRow = circuits.filter((c) => c.rowId === rowId);
    if (inRow.length) {
      const ok = await confirmDialog({
        title: `Supprimer la ligne ${idx + 1} ?`,
        message: `${inRow.length} case(s) de cette ligne seront aussi supprimées.`,
        confirmLabel: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
    }
    await removeLine(panel, circuits, rowId);
  };

  const selectedCell = selected ? cellById.get(selected) : undefined;
  const compact = typing && !tablet && Boolean(selectedCell);
  const selectedRowId = selected ? circuits.find((c) => c.id === selected)?.rowId : undefined;
  const iconCircuit = circuits.find((c) => c.id === iconFor);

  /* ---------------------------- Aperçu ---------------------------- */
  const preview = (
    <div className="flex flex-col gap-3">
      <div className={`items-center justify-between gap-2 ${compact ? 'hidden' : 'flex'}`}>
        <h2 className="text-base font-extrabold text-gray-900">Aperçu en direct</h2>
        <button
          type="button"
          onClick={() => setLarge((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800"
          aria-pressed={large}
        >
          {large ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
          {large ? 'Ajuster' : 'Agrandir'}
        </button>
      </div>
      {strips.map((s, i) => {
        const cap = template.modulesPerRow;
        if (compact && s.rowId !== selectedRowId) return null;
        return (
          <div key={s.rowId}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-gray-700">{lineTitle(i, s.rowName)}</span>
              <Badge tone={s.overflow ? 'red' : s.usedModules === cap ? 'green' : 'gray'}>
                {s.usedModules} / {cap} modules
              </Badge>
            </div>
            <div className={`rounded-lg border border-gray-300 bg-white p-1 ${large ? 'overflow-x-auto' : ''}`}>
              <LabelStripView strip={s} template={template} pxPerMm={large ? 4 : undefined} onCellClick={(id) => select(id, true)} highlightId={selected} />
            </div>
            {s.overflow > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{s.overflow} module(s) de trop : ils ne seront pas imprimés.</p>}
          </div>
        );
      })}
      {selectedCell ? (
        <div className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-gray-200">
          <ZoomCell cell={selectedCell} template={template} />
          <p className="min-w-0 text-xs text-gray-600">
            <span className="block font-bold text-gray-900">Case {selectedCell.number || '—'}</span>
            {selectedCell.widthMm} × {template.labelHeightMm} mm · {selectedCell.modules} module{selectedCell.modules > 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Touchez une case de l’aperçu pour la modifier.</p>
      )}
    </div>
  );

  /* ---------------------------- Réglages ---------------------------- */
  const settings = (
    <div className="flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
      <Step n={1} title="Tableau">
        <div role="radiogroup" aria-label="Marque du tableau" className="grid grid-cols-3 gap-2">
          {BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={brand === b}
              onClick={() => pickBrand(b)}
              className={`min-h-12 rounded-xl border-2 text-sm font-extrabold transition-colors ${
                brand === b ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <SelectField
          label="Modèle d’étiquette"
          value={template.id}
          onValueChange={(v) => void savePanel({ ...panel, templateId: v })}
          options={(brandTemplates.length ? brandTemplates : templates).map((t) => ({ value: t.id, label: `${t.name} — ${t.modulesPerRow} modules` }))}
        />
        {!BRANDS.includes(brand as (typeof BRANDS)[number]) && <p className="text-xs text-gray-500">Modèle personnalisé ({brand}).</p>}
      </Step>

      <Step n={2} title="Dimensions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <Stepper
            label="Largeur d’un module"
            value={template.modulePitchMm}
            step={0.5}
            min={6}
            max={59}
            decimals={1}
            suffix="mm"
            hint={`Largeur d’une ligne : ${String(template.rowWidthMm).replace('.', ',')} mm`}
            onChange={(v) => setTpl({ modulePitchMm: v })}
          />
          <Stepper
            label="Hauteur des étiquettes"
            value={template.labelHeightMm}
            step={0.5}
            min={4}
            max={79}
            decimals={1}
            suffix="mm"
            hint="Mesurez le porte-étiquette de votre tableau."
            onChange={(v) => setTpl({ labelHeightMm: v })}
          />
          <Stepper label="Modules par ligne" value={template.modulesPerRow} min={1} max={40} onChange={(v) => setTpl({ modulesPerRow: v })} />
          <Stepper label="Nombre de lignes" value={panel.rows.length} min={1} max={MAX_LINES} onChange={(v) => void setLineCount(v)} />
        </div>
        {modified && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            icon={<RotateCcw className="size-4" aria-hidden />}
            onClick={() => void resetBuiltinTemplate(template)}
          >
            Valeurs d’origine du modèle {template.name}
          </Button>
        )}
      </Step>

      <Step n={3} title="Texte">
        <Stepper
          label="Taille du texte"
          value={template.fontSizePt}
          step={0.5}
          min={4}
          max={30}
          decimals={1}
          suffix="pt"
          hint="Le texte est réduit automatiquement s’il est trop long pour la case."
          onChange={(v) => setTpl({ fontSizePt: v })}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-700">Alignement du texte</span>
          <Segmented<TextAlign>
            ariaLabel="Alignement du texte"
            value={template.textAlign}
            onChange={(v) => setTpl({ textAlign: v })}
            options={[
              { value: 'left', ariaLabel: 'Aligné à gauche', label: <AlignLabel icon={<AlignLeft className="size-4" aria-hidden />} text="Gauche" /> },
              { value: 'center', ariaLabel: 'Centré', label: <AlignLabel icon={<AlignCenter className="size-4" aria-hidden />} text="Centre" /> },
              { value: 'right', ariaLabel: 'Aligné à droite', label: <AlignLabel icon={<AlignRight className="size-4" aria-hidden />} text="Droite" /> },
            ]}
          />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
          <Toggle label="Numéros" checked={template.showNumber} onChange={(v) => setTpl({ showNumber: v })} />
          <Toggle label="Pictogrammes" checked={template.showIcon} onChange={(v) => setTpl({ showIcon: v })} />
          <Toggle label="Texte sur 2 lignes" checked={template.maxLines === 2} onChange={(v) => setTpl({ maxLines: v ? 2 : 1 })} />
        </div>
      </Step>

      <Step n={4} title="Étiquettes">
        {panel.rows.map((row, ri) => {
          const cases = rowCases(circuits, row.id);
          const used = usedModules(circuits, row.id);
          return (
            <section key={row.id} aria-label={lineTitle(ri, row.name)} className="-mx-1 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 sm:mx-0 sm:p-2">
              <div className="flex items-center gap-1 pb-2 pl-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-extrabold text-gray-900"
                  onClick={async () => {
                    const n = await promptDialog({ title: 'Nom de la ligne', label: 'Nom', defaultValue: row.name });
                    if (n?.trim()) await renameLine(panel, row.id, n.trim());
                  }}
                >
                  {lineTitle(ri, row.name)} <Pencil className="inline size-3.5 text-gray-400" aria-hidden />
                </button>
                <Badge tone={used > template.modulesPerRow ? 'red' : 'gray'}>
                  {used}/{template.modulesPerRow}
                </Badge>
                <IconButton
                  label={`Dupliquer la ligne ${ri + 1}`}
                  icon={<Copy className="size-4" aria-hidden />}
                  disabled={panel.rows.length >= MAX_LINES}
                  onClick={async () => {
                    await duplicateLine(panel, circuits, row.id);
                    toast.success(`Ligne ${ri + 1} dupliquée ✓`);
                  }}
                />
                <IconButton
                  label={`Supprimer la ligne ${ri + 1}`}
                  icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
                  disabled={panel.rows.length <= 1}
                  onClick={() => void deleteLine(row.id)}
                />
              </div>
              <div className="flex flex-col gap-2">
                {cases.length === 0 && <p className="px-1 text-sm text-gray-500">Aucune case sur cette ligne.</p>}
                {cases.map((c, i) => (
                  <CaseEditor
                    key={c.id}
                    ref={(el) => {
                      if (el) caseRefs.current.set(c.id, el);
                      else caseRefs.current.delete(c.id);
                    }}
                    circuit={c}
                    label={labelFor(c.id)}
                    text={textOf(c)}
                    selected={selected === c.id}
                    first={i === 0}
                    last={i === cases.length - 1}
                    onSelect={() => setSelected(c.id)}
                    onText={(t) => onText(c, t)}
                    onFocusText={() => setTyping(true)}
                    onBlur={() => {
                      // Léger délai : un toucher sur l'aperçu n'est pas perdu pendant le changement de mise en page
                      window.setTimeout(() => {
                        if (!document.activeElement?.matches('input[data-case-text]')) setTyping(false);
                      }, 250);
                      void flushText(c.id);
                    }}
                    onNumber={(n) => void setCaseNumber(c, n)}
                    onModules={(m) => void setCaseModules(c, m)}
                    onMove={(dir) => void shiftCase(circuits, c.id, dir)}
                    onIcon={() => setIconFor(c.id)}
                    onDelete={() => void deleteCase(c)}
                  />
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 text-brand-600"
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => void newCase(row.id)}
              >
                Ajouter une case
              </Button>
            </section>
          );
        })}
        <Button icon={<Plus className="size-5" aria-hidden />} disabled={panel.rows.length >= MAX_LINES} onClick={() => void addLine(panel)}>
          Ajouter une ligne
        </Button>
      </Step>

      <Step n={5} title="Imprimer">
        <LabelPrintPanel
          panelId={panel.id}
          strips={strips}
          template={template}
          calibration={cal}
          printers={printers}
          printer={printer}
          name={name}
          disabled={!circuits.length}
        />
      </Step>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100 md:h-dvh">
      <AppHeader
        title="Étiquettes tableau"
        subtitle={name}
        back={panel.projectId ? `/panel/${panel.id}` : '/labels'}
        actions={
          <>
            <IconButton
              tone="dark"
              label="Circuits du tableau"
              icon={<ListOrdered className="size-5" aria-hidden />}
              onClick={() => navigate(`/panel/${panel.id}`)}
            />
            <IconButton
              tone="dark"
              label="Modèles d’étiquettes"
              icon={<SlidersHorizontal className="size-5" aria-hidden />}
              onClick={() => navigate('/templates')}
            />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:min-h-0 md:flex-row">
        {/* Aperçu : à droite (tablette / ordinateur), en haut et toujours visible (téléphone) */}
        <section
          aria-label="Aperçu en direct"
          className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 max-h-[45dvh] overflow-y-auto border-b border-gray-200 bg-gray-100/95 p-3 shadow-sm backdrop-blur md:static md:order-last md:max-h-none md:min-h-0 md:flex-1 md:border-b-0 md:p-5 md:shadow-none"
        >
          {preview}
        </section>
        {/* Réglages : à gauche */}
        <aside
          aria-label="Réglages des étiquettes"
          className="pb-safe md:w-[400px] md:min-h-0 md:shrink-0 md:overflow-y-auto md:border-r md:border-gray-200 md:bg-white lg:w-[440px]"
        >
          {settings}
        </aside>
      </div>

      <Sheet open={Boolean(iconCircuit)} onClose={() => setIconFor(null)} title="Pictogramme de la case" desktop="center">
        {iconCircuit && (
          <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6">
            <button
              type="button"
              onClick={async () => {
                await setCaseIcon(iconCircuit, labelFor(iconCircuit.id), null);
                setIconFor(null);
              }}
              className="min-h-16 rounded-xl border border-gray-200 text-sm font-semibold"
            >
              Aucun
            </button>
            {LABEL_ICON_CHOICES.map((ic) => (
              <button
                key={ic.symbolId}
                type="button"
                aria-label={ic.label}
                onClick={async () => {
                  await setCaseIcon(iconCircuit, labelFor(iconCircuit.id), ic.symbolId);
                  setIconFor(null);
                }}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-gray-200 p-1 text-[10px] font-semibold text-gray-600"
              >
                <SymbolIcon id={ic.symbolId} size={30} color="#111827" />
                {ic.label}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function lineTitle(index: number, name: string): string {
  return /^Rangée \d+$/.test(name) ? `Ligne ${index + 1}` : `Ligne ${index + 1} · ${name}`;
}

function AlignLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1">
      {icon}
      <span className="text-sm">{text}</span>
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4 md:shadow-none">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-gray-900">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-sm text-white">{n}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Case sélectionnée, affichée en grand pour vérifier la lisibilité. */
function ZoomCell({ cell, template }: { cell: LabelCell; template: PanelTemplate }) {
  const tpl = { ...template, rowWidthMm: cell.widthMm, marginLeftMm: 0, marginRightMm: 0, marginTopMm: 0, marginBottomMm: 0 };
  const strip = { rowId: 'zoom', rowName: 'Zoom', cells: [{ ...cell, xMm: 0 }], usedModules: cell.modules, overflow: 0 };
  const phone = typeof window !== 'undefined' && window.innerWidth < 768;
  const px = Math.max(3, Math.min(9, (phone ? 120 : 150) / cell.widthMm, (phone ? 76 : 110) / template.labelHeightMm));
  return (
    <div className="shrink-0 overflow-hidden rounded ring-1 ring-gray-300">
      <LabelStripView strip={strip} template={tpl} pxPerMm={px} />
    </div>
  );
}

interface CaseEditorProps {
  circuit: ElectricalCircuit;
  label?: Label;
  text: string;
  selected: boolean;
  first: boolean;
  last: boolean;
  ref: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onText: (text: string) => void;
  onFocusText: () => void;
  onBlur: () => void;
  onNumber: (n: string) => void;
  onModules: (m: number) => void;
  onMove: (dir: -1 | 1) => void;
  onIcon: () => void;
  onDelete: () => void;
}

/** Une case d'étiquette : numéro, pictogramme, texte, largeur, déplacement, suppression. */
function CaseEditor({
  circuit,
  label,
  text,
  selected,
  first,
  last,
  ref,
  onSelect,
  onText,
  onFocusText,
  onBlur,
  onNumber,
  onModules,
  onMove,
  onIcon,
  onDelete,
}: CaseEditorProps) {
  const icon = label?.icon === null ? undefined : (label?.icon ?? circuit.icon);
  const [num, setNum] = useState(circuit.number);
  useEffect(() => setNum(circuit.number), [circuit.number]);
  const small =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 active:bg-gray-100 disabled:opacity-30';
  return (
    <div
      ref={ref}
      onFocusCapture={onSelect}
      onClick={onSelect}
      className={`scroll-mt-72 rounded-xl border bg-white p-2 transition-shadow md:scroll-mt-4 ${selected ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-2">
        <input
          aria-label="Numéro de la case"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          onBlur={() => num !== circuit.number && onNumber(num)}
          className="h-11 w-12 shrink-0 rounded-xl border border-gray-300 text-center text-base font-extrabold tabular-nums"
        />
        <button type="button" onClick={onIcon} aria-label="Changer le pictogramme" className={small}>
          {icon ? <SymbolIcon id={icon} size={28} color="#111827" /> : <span className="text-[10px] font-semibold text-gray-400">Picto</span>}
        </button>
        <input
          data-case-text
          aria-label={`Texte de la case ${circuit.number}`}
          value={text}
          placeholder="ex. Éclairage cuisine"
          onChange={(e) => onText(e.target.value)}
          onFocus={onFocusText}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base font-semibold text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button type="button" className={`${small} text-red-600`} onClick={onDelete} aria-label={`Supprimer la case ${circuit.number}`}>
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" className={small} disabled={first} onClick={() => onMove(-1)} aria-label="Déplacer la case à gauche">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <button type="button" className={small} disabled={last} onClick={() => onMove(1)} aria-label="Déplacer la case à droite">
          <ArrowRight className="size-5" aria-hidden />
        </button>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Largeur de la case">
          <button type="button" className={small} disabled={circuit.modules <= 1} onClick={() => onModules(circuit.modules - 1)} aria-label="Case plus étroite">
            −
          </button>
          <span className="w-16 text-center text-xs font-bold leading-tight text-gray-700">
            {circuit.modules} module{circuit.modules > 1 ? 's' : ''}
          </span>
          <button type="button" className={small} disabled={circuit.modules >= 8} onClick={() => onModules(circuit.modules + 1)} aria-label="Case plus large">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
