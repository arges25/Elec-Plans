import { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import type { EnclosureModel } from '../types';
import { brandName, formatDimensions, formatMm, mountingLabel } from '../data/catalog';
import { NOT_PROVIDED, REFERENCE_NOT_PROVIDED } from '../constants';

function Row({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`text-right font-semibold ${missing ? 'font-normal text-amber-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

/** Caractéristiques du coffret, avec la source officielle (bouton « i »). */
export function EnclosureInfo({ enclosure: e }: { enclosure: EnclosureModel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm" data-testid="enclosure-info">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            {brandName(e.brand)} · {e.family}
          </p>
          <p className="text-base font-bold text-slate-900">{e.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Informations et source des données"
          title="Informations et source des données"
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${open ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >
          <Info className="size-4.5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        <Row label="Référence" value={e.reference ?? REFERENCE_NOT_PROVIDED} missing={!e.reference} />
        <Row label="Rangées" value={`${e.rows} × ${e.modulesPerRow} modules`} />
        <Row label="Capacité" value={`${e.totalModules} modules`} />
        <Row label="Dimensions (L × H × P)" value={formatDimensions(e.dimensions)} missing={!e.dimensions} />
        {open && (
          <>
            <Row label="Entraxe des rails" value={e.rowPitchMm ? `${formatMm(e.rowPitchMm)} mm` : NOT_PROVIDED} missing={!e.rowPitchMm} />
            <Row label="Installation" value={mountingLabel(e.mounting)} missing={!e.mounting} />
            <div className="py-2 text-sm">
              <p className="text-slate-500">Source</p>
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-semibold text-blue-700 underline">
                  {e.sourceName ?? e.sourceUrl} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <p className="font-semibold text-amber-700">{NOT_PROVIDED}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">Dernière vérification : {e.lastVerified ?? 'non renseignée'}</p>
            </div>
          </>
        )}
      </div>
      {!e.dimensions && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-800">
          Dimensions extérieures absentes de la base locale : le tableau est affiché en vue schématique (grille modulaire uniquement), sans cote.
        </p>
      )}
    </div>
  );
}
