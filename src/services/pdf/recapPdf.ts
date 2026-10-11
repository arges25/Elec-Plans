import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { Project } from '../../types';
import type { CircuitReport, CircuitStatus, ProjectRecap } from '../panelRecap';
import { CIRCUIT_TYPE_LABELS } from '../panelRecap';
import { formatAmps, formatSection } from '../../utils/electrical';
import { formatDate } from '../../utils/format';
import { BLACK, GRAY, LIGHT_GRAY, ORANGE, drawLine, drawLogo, drawText, hexToRgb, wrapText, type Ctx } from './pdfUtils';

/** Couleurs des indicateurs (identiques à l'écran). */
export const STATUS_STYLE: Record<CircuitStatus, { label: string; color: string }> = {
  ok: { label: 'OK', color: '#16a34a' },
  warn: { label: 'Proche de la limite', color: '#f97316' },
  error: { label: 'Limite dépassée', color: '#dc2626' },
  unknown: { label: 'Non vérifié', color: '#9ca3af' },
};

/** Libellé court de l'état d'un circuit (« À préciser » si l'orange vient d'une information manquante). */
export function statusLabel(c: CircuitReport): string {
  if (c.status === 'error' && c.max !== null && c.count > c.max) return 'Limite dépassée';
  if (c.status === 'error') return 'Non conforme';
  if (c.status === 'warn' && c.max !== null && c.count >= c.max) return 'Limite atteinte';
  if (c.status === 'warn' && !c.messages.some((m) => m.startsWith('Proche'))) return 'À préciser';
  return STATUS_STYLE[c.status].label;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 36;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Column {
  title: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

/** Récapitulatif du tableau en PDF (A4 portrait), pour l'export ou le partage. */
export async function generateRecapPdf(project: Project, recap: ProjectRecap): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Récapitulatif du tableau — ${project.name}`);
  pdf.setCreator('MG Elec & Plans');
  const fonts: Fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  let ctx: Ctx = { page: pdf.addPage([PAGE_W, PAGE_H]), H: PAGE_H };
  let y = M;
  const contentW = PAGE_W - 2 * M;

  const newPage = () => {
    ctx = { page: pdf.addPage([PAGE_W, PAGE_H]), H: PAGE_H };
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - 18) newPage();
  };
  const section = (title: string) => {
    ensure(40);
    y += 14;
    drawText(ctx, title.toUpperCase(), M, y, { font: fonts.bold, size: 10, color: ORANGE });
    y += 6;
    drawLine(ctx, M, y, M + contentW, y, ORANGE, 1);
    y += 6;
  };
  const tableHeader = (cols: Column[]) => {
    ensure(20);
    ctx.page.drawRectangle({ x: M, y: PAGE_H - y - 16, width: contentW, height: 16, color: hexToRgb('#111827') });
    let x = M;
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.width - 4 : c.align === 'center' ? x + c.width / 2 : x + 4;
      drawText(ctx, c.title, tx, y + 11.5, { font: fonts.bold, size: 8, color: rgb(1, 1, 1), align: c.align, maxWidth: c.width - 6 });
      x += c.width;
    }
    y += 16;
  };
  const tableRow = (cols: Column[], cells: string[], opts: { bold?: boolean; sub?: string; dot?: string; fill?: boolean } = {}) => {
    const subLines = opts.sub ? wrapText(fonts.regular, opts.sub, 7.5, contentW - 40) : [];
    const h = 15 + subLines.length * 9.5;
    ensure(h);
    if (opts.fill) ctx.page.drawRectangle({ x: M, y: PAGE_H - y - h, width: contentW, height: h, color: hexToRgb('#f3f4f6') });
    let x = M;
    cols.forEach((c, i) => {
      let tx = c.align === 'right' ? x + c.width - 4 : c.align === 'center' ? x + c.width / 2 : x + 4;
      if (i === cols.length - 1 && opts.dot) {
        ctx.page.drawCircle({ x: x + 8, y: PAGE_H - (y + 7.5), size: 3.5, color: hexToRgb(opts.dot) });
        tx = x + 15;
      }
      drawText(ctx, cells[i] ?? '', tx, y + 10.5, {
        font: opts.bold ? fonts.bold : fonts.regular,
        size: 8.5,
        color: BLACK,
        align: i === cols.length - 1 && opts.dot ? 'left' : c.align,
        maxWidth: c.width - (i === cols.length - 1 && opts.dot ? 18 : 6),
      });
      x += c.width;
    });
    subLines.forEach((l, k) => drawText(ctx, l, M + 32, y + 15 + 7.5 + k * 9.5, { font: fonts.regular, size: 7.5, color: GRAY }));
    y += h;
    drawLine(ctx, M, y, M + contentW, y, LIGHT_GRAY, 0.6);
  };

  // En-tête
  drawLogo(ctx, M, y, 34);
  drawText(ctx, 'Récapitulatif du tableau électrique', M + 44, y + 14, { font: fonts.bold, size: 16 });
  drawText(ctx, [project.name, project.clientName].filter(Boolean).join(' — '), M + 44, y + 29, {
    font: fonts.regular,
    size: 10,
    color: GRAY,
    maxWidth: contentW - 44,
  });
  y += 44;
  const address = [project.address, project.city].filter(Boolean).join(', ');
  drawText(ctx, [address, `Édité le ${formatDate(Date.now())}`].filter(Boolean).join(' · '), M, y, {
    font: fonts.regular,
    size: 8.5,
    color: GRAY,
    maxWidth: contentW,
  });
  y += 10;

  // Synthèse
  const t = recap.totals;
  const sc = recap.statusCount;
  section('Synthèse');
  const summary = [
    `Prises : ${t.sockets} (${t.socketPoints} point${t.socketPoints > 1 ? 's' : ''} d’utilisation)`,
    `Commandes : ${t.switches}`,
    `Points lumineux : ${t.lights}`,
    `Appareils spécialisés : ${t.dedicated}`,
    `Circuits : ${recap.circuits.length} — OK ${sc.ok} · proches de la limite / à préciser ${sc.warn} · limite dépassée ${sc.error} · non vérifiés ${sc.unknown}`,
  ];
  if (recap.unassigned.length) summary.push(`Éléments sans circuit : ${recap.unassigned.length}`);
  for (const line of summary) {
    ensure(13);
    drawText(ctx, line, M, y + 9, { font: fonts.regular, size: 9.5, maxWidth: contentW });
    y += 13;
  }

  // Circuits
  section('Circuits');
  const cc: Column[] = [
    { title: 'N°', width: 28, align: 'center' },
    { title: 'Circuit', width: 160 },
    { title: 'Type', width: 72 },
    { title: 'Section', width: 52, align: 'center' },
    { title: 'Calibre', width: 46, align: 'center' },
    { title: 'Éléments', width: 60, align: 'center' },
    { title: 'État', width: contentW - 418 },
  ];
  tableHeader(cc);
  for (const c of recap.circuits) {
    tableRow(
      cc,
      [
        c.number || '–',
        c.name,
        c.dedicatedRule && c.type === 'specialise' ? c.dedicatedRule.label : CIRCUIT_TYPE_LABELS[c.type],
        c.sectionMm2 !== null ? formatSection(c.sectionMm2) : '?',
        c.breakerA !== null ? formatAmps(c.breakerA) : '?',
        c.max !== null ? `${c.count} / ${c.max}` : String(c.count),
        statusLabel(c),
      ],
      { dot: STATUS_STYLE[c.status].color, sub: c.messages.filter((m) => !m.startsWith('Proche') && !m.startsWith('Limite')).join(' · ') || undefined },
    );
  }

  if (recap.unassigned.length) {
    section('Éléments sans circuit');
    const groups = new Map<string, number>();
    for (const e of recap.unassigned) {
      const k = `${e.floorName} — ${e.room}`;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    for (const [k, n] of groups) {
      ensure(12);
      drawText(ctx, `${k} : ${n} élément${n > 1 ? 's' : ''}`, M, y + 9, { font: fonts.regular, size: 9 });
      y += 12;
    }
  }

  // Par pièce
  section('Par niveau et par pièce');
  const rc: Column[] = [
    { title: 'Niveau', width: 90 },
    { title: 'Pièce', width: 150 },
    { title: 'Prises', width: 65, align: 'center' },
    { title: 'Commandes', width: 75, align: 'center' },
    { title: 'Lumières', width: 70, align: 'center' },
    { title: 'Spécialisés', width: contentW - 450, align: 'center' },
  ];
  tableHeader(rc);
  for (const r of recap.rooms) tableRow(rc, [r.floorName, r.room, String(r.sockets), String(r.switches), String(r.lights), String(r.dedicated)]);
  tableRow(rc, ['Total', '', String(t.sockets), String(t.switches), String(t.lights), String(t.dedicated)], { bold: true, fill: true });

  // Matériel
  section('Matériel du tableau');
  const mc: Column[] = [
    { title: 'Désignation', width: contentW - 60 },
    { title: 'Qté', width: 60, align: 'center' },
  ];
  tableHeader(mc);
  for (const l of recap.material) tableRow(mc, [l.detail ? `${l.label} — ${l.detail}` : l.label, String(l.qty)]);
  for (const n of recap.materialNotes) {
    ensure(11);
    drawText(ctx, `• ${n}`, M, y + 10, { font: fonts.regular, size: 7.5, color: GRAY, maxWidth: contentW });
    y += 11;
  }

  // Pied de page sur chaque page
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    const pctx: Ctx = { page, H: PAGE_H };
    drawText(
      pctx,
      'Vérification indicative (règles NF C 15-100 paramétrées dans l’application) : ne remplace pas la norme ni l’avis d’un professionnel.',
      M,
      PAGE_H - 22,
      {
        font: fonts.regular,
        size: 6.5,
        color: GRAY,
        maxWidth: contentW - 60,
      },
    );
    drawText(pctx, `${i + 1} / ${pages.length}`, PAGE_W - M, PAGE_H - 22, { font: fonts.regular, size: 7, color: GRAY, align: 'right' });
  });
  return pdf.save();
}
