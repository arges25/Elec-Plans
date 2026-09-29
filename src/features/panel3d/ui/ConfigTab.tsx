import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { Brand, EnclosureModel, PlacedDevice } from '../types';
import { BRANDS, brandName, findEnclosure, getEnclosure, getProduct, listEnclosures, listFamilies, modulesOptions, rowsOptions } from '../data/catalog';
import { boardGeometry } from '../engine/geometry';
import { BoardSvg, boardViewBox } from '../render/BoardSvg';
import { SchemaSvg } from '../render/SchemaSvg';
import { previewDoc } from '../store/projectFactory';
import { usePanelEditor } from '../store/panelEditorStore';
import { EnclosureInfo } from './EnclosureInfo';
import { STYLE_OPTIONS } from './CircuitEditor';
import { confirmDialog } from '../../../store/dialogStore';
import { toast } from '../../../store/toastStore';

/**
 * Onglet 1 — Configuration : Fabricant → Gamme → 13 / 18 modules → Rangées.
 * Seules les combinaisons présentes dans la base du fabricant sont proposées.
 */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-600 text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ active, onClick, children, testId, label }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      data-testid={testId}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center transition-colors ${
        active ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
      }`}
    >
      {active && (
        <span className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="size-3.5" aria-hidden />
        </span>
      )}
      {children}
    </button>
  );
}

/** Miniature du coffret vide (proportions réelles quand elles sont connues). */
function EnclosureThumb({ enc, height }: { enc: EnclosureModel; height: number }) {
  const preview = useMemo(() => previewDoc(enc.brand, enc.id), [enc]);
  const vb = boardViewBox(boardGeometry(enc));
  return <BoardSvg doc={preview} enclosure={enc} uid={`th-${enc.id}`} width={(vb.w / vb.h) * height} height={height} preciseMeasure={false} />;
}

function removedMessage(removed: PlacedDevice[]): string {
  const names = removed.map((d) => getProduct(d.productId)?.shortName ?? 'appareil');
  return `${removed.length} appareil(s) retiré(s) faute de place ou d’équivalent : ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}`;
}

export function ConfigTab({ onDone }: { onDone: () => void }) {
  const project = usePanelEditor((s) => s.doc)!;
  const enc = getEnclosure(project.enclosureId)!;
  const families = listFamilies(project.brand);
  const mods = modulesOptions(project.brand, enc.family);
  const rows = rowsOptions(project.brand, enc.family, enc.modulesPerRow);

  const applyEnclosure = async (target: EnclosureModel | undefined) => {
    if (!target || target.id === enc.id) return;
    const editor = usePanelEditor.getState();
    if (target.brand !== project.brand) {
      if (project.devices.length) {
        const ok = await confirmDialog({
          title: `Passer en ${brandName(target.brand)} ?`,
          message: 'Les appareils seront remplacés par leurs équivalents de la nouvelle marque (même type et calibre). Les marques ne sont jamais mélangées. Action annulable.',
          confirmLabel: 'Changer de marque',
        });
        if (!ok) return;
      }
      const removed = editor.setBrand(target.brand, target.id);
      if (removed.length) toast.info(removedMessage(removed), { label: 'Annuler', onClick: () => usePanelEditor.getState().undo() });
      return;
    }
    const removed = editor.setEnclosure(target.id);
    if (removed.length) toast.info(removedMessage(removed), { label: 'Annuler', onClick: () => usePanelEditor.getState().undo() });
  };

  const pickBrand = (b: Brand) => {
    if (b === project.brand) return;
    // Même configuration si elle existe chez l'autre fabricant, sinon son coffret par défaut
    const list = listEnclosures(b);
    const same = list.find((e) => e.modulesPerRow === enc.modulesPerRow && e.rows === enc.rows);
    void applyEnclosure(same ?? list.find((e) => e.rows === 2) ?? list[0]);
  };
  const pickFamily = (f: string) => {
    const list = listEnclosures(project.brand).filter((e) => e.family === f);
    void applyEnclosure(list.find((e) => e.modulesPerRow === enc.modulesPerRow && e.rows === enc.rows) ?? list[0]);
  };
  const pickModules = (m: number) => {
    const avail = rowsOptions(project.brand, enc.family, m);
    const r = avail.includes(enc.rows) ? enc.rows : avail[avail.length - 1];
    void applyEnclosure(findEnclosure(project.brand, enc.family, m, r));
  };
  const pickRows = (r: number) => void applyEnclosure(findEnclosure(project.brand, enc.family, enc.modulesPerRow, r));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_380px]" data-testid="config-tab">
      <div className="space-y-4">
        <Step n={1} title="Fabricant">
          <div className="grid grid-cols-3 gap-2">
            {BRANDS.map((b) => (
              <Choice key={b.id} active={project.brand === b.id} onClick={() => pickBrand(b.id)} testId={`brand-${b.id}`}>
                <span className="text-sm font-bold sm:text-base">{b.name}</span>
                <span className="text-xs text-slate-500">{b.family}</span>
              </Choice>
            ))}
          </div>
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-sm">
            <span>
              <span className="font-semibold">Afficher tous les fabricants</span>
              <span className="block text-xs text-slate-500">Bibliothèque d’appareils de toutes les marques (désactivé : marque du tableau uniquement)</span>
            </span>
            <input type="checkbox" className="size-5 accent-blue-600" checked={project.showAllBrands} onChange={(e) => usePanelEditor.getState().setSettings({ showAllBrands: e.target.checked })} />
          </label>
        </Step>

        <Step n={2} title="Gamme">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {families.map((f) => (
              <Choice key={f} active={enc.family === f} onClick={() => pickFamily(f)}>
                <span className="font-bold">{f}</span>
                <span className="text-xs text-slate-500">{brandName(project.brand)}</span>
              </Choice>
            ))}
          </div>
        </Step>

        <Step n={3} title="Modules par rangée">
          <div className="grid grid-cols-2 gap-2">
            {mods.map((m) => (
              <Choice key={m} active={enc.modulesPerRow === m} onClick={() => pickModules(m)} testId={`modules-${m}`}>
                <span className="text-2xl font-extrabold">{m}</span>
                <span className="text-xs text-slate-500">modules</span>
              </Choice>
            ))}
          </div>
          {mods.length < 2 && <p className="mt-2 text-xs text-slate-500">Seules les largeurs présentes dans la base officielle de la gamme sont proposées.</p>}
        </Step>

        <Step n={4} title="Nombre de rangées">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rows.map((r) => {
              const e = findEnclosure(project.brand, enc.family, enc.modulesPerRow, r)!;
              return (
                <Choice key={r} active={enc.rows === r} onClick={() => pickRows(r)} testId={`rows-${r}`} label={`${r} rangée${r > 1 ? 's' : ''}`}>
                  <span className="flex h-28 items-center justify-center">
                    <EnclosureThumb enc={e} height={Math.min(110, 34 + r * 19)} />
                  </span>
                  <span className="font-bold">
                    {r} rangée{r > 1 ? 's' : ''}
                  </span>
                  <span className="text-[11px] text-slate-500">{e.reference ?? '—'}</span>
                </Choice>
              );
            })}
          </div>
          {enc.modulesPerRow === 18 && rows.length === 1 && (
            <p className="mt-2 text-xs text-slate-500">En 18 modules, seule la version 4 rangées est vérifiée dans la base officielle.</p>
          )}
        </Step>

        <Step n={5} title="Étiquettes et circuits">
          <p className="mb-2 text-sm font-semibold text-slate-800">Mode d’étiquette</p>
          <div role="radiogroup" aria-label="Mode d’étiquette par défaut" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {STYLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={project.labelStyle === o.value}
                onClick={() => usePanelEditor.getState().setSettings({ labelStyle: o.value })}
                className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-2 ${project.labelStyle === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                <span className="text-sm font-bold">{o.label}</span>
                <span className="text-[11px]">{o.hint}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-sm font-semibold text-slate-800">Texte affiché sous les appareils</p>
          <div role="radiogroup" aria-label="Texte affiché" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['long', 'Nom du circuit', 'ex. Prises cuisine'],
                ['short', 'Nom court', 'ex. PC CUISINE (si renseigné)'],
              ] as const
            ).map(([v, l, h]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={project.labelText === v}
                onClick={() => usePanelEditor.getState().setSettings({ labelText: v })}
                className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-2 ${project.labelText === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                <span className="text-sm font-bold">{l}</span>
                <span className="text-[11px]">{h}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-sm">
            <span>
              <span className="font-semibold">Demander « Quel circuit ? » à la pose d’un disjoncteur</span>
              <span className="block text-xs text-slate-500">Facultatif : vous pouvez toujours écrire vous-même le nom du circuit</span>
            </span>
            <input type="checkbox" className="size-5 accent-blue-600" checked={project.askCircuitOnDrop} onChange={(e) => usePanelEditor.getState().setSettings({ askCircuitOnDrop: e.target.checked })} />
          </label>
        </Step>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <label className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Titre du tableau</span>
          <input
            value={project.title}
            onChange={(e) => usePanelEditor.getState().setBoardMeta({ title: e.target.value })}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-bold uppercase outline-none focus:border-blue-500"
            aria-label="Titre du tableau"
            data-testid="config-title"
          />
          <span className="mt-1 block text-xs text-slate-500">ex. TABLEAU PRINCIPAL, TABLEAU GARAGE, TABLEAU ÉTAGE…</span>
        </label>
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-200 p-3">
          {project.view === 'schema' ? (
            <SchemaSvg doc={project} enclosure={enc} uid="cfg" width="100%" className="h-auto w-full rounded bg-white" />
          ) : (
            <BoardSvg doc={project} enclosure={enc} uid="cfg" width="100%" height={Math.min(420, 110 + enc.rows * 80)} />
          )}
        </div>
        <EnclosureInfo enclosure={enc} />
        <button type="button" onClick={onDone} className="min-h-12 w-full rounded-xl bg-blue-600 font-semibold text-white shadow hover:bg-blue-700" data-testid="config-next">
          Continuer vers l’édition du tableau
        </button>
      </aside>
    </div>
  );
}
