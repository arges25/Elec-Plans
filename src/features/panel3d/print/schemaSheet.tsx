import type { BoardDoc, EnclosureModel, PanelProject } from '../types';
import { getEnclosure } from '../data/catalog';
import { schemaGeometry } from '../engine/schemaGeometry';
import { SchemaSvg } from '../render/SchemaSvg';
import { toDoc } from '../store/projectFactory';

/**
 * Feuille « Schéma tableau » imprimable (A4) : le schéma technique mis à
 * l'échelle de la page, avec un pied de page (projet, tableau, date).
 * Même rendu pour l'aperçu, l'impression système, le PDF et le PNG.
 */

const MARGIN = 10;
const FOOTER = 7;

export interface SchemaPageLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  orientation: 'portrait' | 'landscape';
  x: number;
  y: number;
  w: number;
  h: number;
}

export function schemaPageLayout(enc: EnclosureModel, orientation?: 'portrait' | 'landscape'): SchemaPageLayout {
  const geo = schemaGeometry(enc);
  const o = orientation ?? (geo.height / geo.width > 0.95 ? 'portrait' : 'landscape');
  const pageW = o === 'portrait' ? 210 : 297;
  const pageH = o === 'portrait' ? 297 : 210;
  const availW = pageW - MARGIN * 2;
  const availH = pageH - MARGIN * 2 - FOOTER;
  const k = Math.min(availW / geo.width, availH / geo.height);
  const w = geo.width * k;
  const h = geo.height * k;
  return { pageWidthMm: pageW, pageHeightMm: pageH, orientation: o, x: MARGIN + (availW - w) / 2, y: MARGIN, w, h };
}

/** Orientation commune à plusieurs tableaux (paysage dès qu'un tableau l'exige). */
export function commonOrientation(docs: BoardDoc[]): 'portrait' | 'landscape' {
  return docs.some((d) => {
    const enc = getEnclosure(d.enclosureId);
    return enc ? schemaPageLayout(enc).orientation === 'landscape' : false;
  })
    ? 'landscape'
    : 'portrait';
}

export function footerText(doc: BoardDoc, date = new Date()): string {
  return `${doc.projectName} — ${doc.title} — imprimé le ${date.toLocaleDateString('fr-FR')} — MG Elec & Plans`;
}

interface PageProps {
  doc: BoardDoc;
  orientation?: 'portrait' | 'landscape';
  uid: string;
  /** Aperçu écran : largeur CSS libre au lieu des millimètres. */
  screenWidth?: string;
  preciseMeasure?: boolean;
  date?: Date;
}

export function SchemaPageSvg({ doc, orientation, uid, screenWidth, preciseMeasure = true, date }: PageProps) {
  const enc = getEnclosure(doc.enclosureId);
  if (!enc) return null;
  const l = schemaPageLayout(enc, orientation);
  const W = l.pageWidthMm;
  const H = l.pageHeightMm;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={screenWidth ?? `${W}mm`}
      height={screenWidth ? undefined : `${H}mm`}
      viewBox={`0 0 ${W} ${H}`}
      style={screenWidth ? { display: 'block', width: screenWidth, height: 'auto' } : { left: 0, top: 0 }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
      <SchemaSvg doc={doc} enclosure={enc} uid={uid} x={l.x} y={l.y} width={l.w} height={l.h} preciseMeasure={preciseMeasure} info={`Projet : ${doc.projectName}`} />
      <line x1={MARGIN} x2={W - MARGIN} y1={H - MARGIN - FOOTER + 1.5} y2={H - MARGIN - FOOTER + 1.5} stroke="#d1d5db" strokeWidth={0.2} />
      <text x={MARGIN} y={H - MARGIN} fontFamily="Helvetica, Arial, sans-serif" fontSize={2.8} fill="#6b7280">
        {footerText(doc, date)}
      </text>
    </svg>
  );
}

/** Tableaux à imprimer : le tableau actif, ou tous les tableaux du projet. */
export function docsFor(project: PanelProject, scope: 'current' | 'all'): BoardDoc[] {
  const boards = scope === 'all' ? project.boards : project.boards.filter((b) => b.id === project.activeBoardId);
  return boards.map((b) => toDoc(project, b));
}
