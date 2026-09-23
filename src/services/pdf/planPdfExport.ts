import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import type { Plan, PlanDocument, Project } from '../../types';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { mmToPt, paperSizeMm, type PaperFormat, type PaperOrientation } from '../../utils/units';
import { bezierPoint, bezierToSvgPath, distance, emptyBounds, extendBounds, isBoundsValid } from '../../utils/geometry';
import { connectionGeometry, dashPattern } from '../../utils/connections';
import { doorGeometry, openingFrame } from '../../utils/openings';
import { buildLegend } from '../../utils/legend';
import { formatDate, formatMeters } from '../../utils/format';
import { symbolUnitScale, symbolWorldSize } from '../../utils/symbols';
import { dataUrlToEmbeddable } from '../imageProcessing';
import { BLACK, GRAY, LIGHT_GRAY, ORANGE, WHITE, drawLine, drawLogo, drawPath, drawSymbolPrimitives, drawText, hexToRgb, wrapText, type Ctx } from './pdfUtils';

export interface PlanPdfOptions {
  format: PaperFormat;
  orientation: PaperOrientation;
  marginMm: number;
  title: string;
  showProjectName: boolean;
  showClient: boolean;
  showDate: boolean;
  showAddress: boolean;
  showLegend: boolean;
  showNotes: boolean;
  showConnections: boolean;
  showOriginal: boolean;
  showReconstructed: boolean;
  showAnnotations: boolean;
  showMeasures: boolean;
  includeLogo: boolean;
}

export const DEFAULT_PDF_OPTIONS: PlanPdfOptions = {
  format: 'A4',
  orientation: 'landscape',
  marginMm: 10,
  title: 'Plan d’implantation électrique',
  showProjectName: true,
  showClient: true,
  showDate: true,
  showAddress: true,
  showLegend: true,
  showNotes: true,
  showConnections: true,
  showOriginal: true,
  showReconstructed: true,
  showAnnotations: true,
  showMeasures: true,
  includeLogo: true,
};

export interface PlanPage {
  plan: Plan;
  doc: PlanDocument;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Zone de dessin en points (repère page, Y vers le bas). */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Génère le PDF (vectoriel) du plan : une page par niveau sélectionné. */
export async function generatePlanPdf(project: Project, pages: PlanPage[], options: PlanPdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${options.title} — ${project.name}`);
  pdf.setAuthor('MG Elec & Plans');
  pdf.setCreator('MG Elec & Plans');
  pdf.setProducer('MG Elec & Plans (pdf-lib)');
  pdf.setSubject('Plan simplifié destiné à l’implantation électrique');
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const size = paperSizeMm(options.format, options.orientation);
  const W = mmToPt(size.width);
  const H = mmToPt(size.height);
  const m = mmToPt(options.marginMm);

  for (let i = 0; i < pages.length; i++) {
    const { plan, doc } = pages[i];
    const page = pdf.addPage([W, H]);
    const ctx: Ctx = { page, H };
    const headerH = mmToPt(18);
    const footerH = mmToPt(7);
    drawHeader(ctx, project, plan, options, fonts, { x: m, y: m, w: W - 2 * m, h: headerH });
    drawFooter(ctx, fonts, { x: m, y: H - m - footerH, w: W - 2 * m, h: footerH }, i + 1, pages.length);

    let content: Box = { x: m, y: m + headerH + mmToPt(3), w: W - 2 * m, h: H - 2 * m - headerH - footerH - mmToPt(5) };
    const legend = options.showLegend ? buildLegend(doc.symbols) : [];
    const notes = options.showNotes && project.notes.trim() ? project.notes.trim() : '';
    const hasSide = legend.length > 0 || notes;
    let side: Box | null = null;
    if (hasSide) {
      if (options.orientation === 'landscape') {
        const sw = mmToPt(options.format === 'A3' ? 70 : 58);
        side = { x: content.x + content.w - sw, y: content.y, w: sw, h: content.h };
        content = { ...content, w: content.w - sw - mmToPt(4) };
      } else {
        const lines = Math.ceil(legend.length / 2) + (notes ? 4 : 0) + 2;
        const sh = Math.min(content.h * 0.38, mmToPt(6) + lines * mmToPt(5.2));
        side = { x: content.x, y: content.y + content.h - sh, w: content.w, h: sh };
        content = { ...content, h: content.h - sh - mmToPt(4) };
      }
    }

    await drawPlan(pdf, ctx, plan, doc, options, fonts, content);
    if (side) drawLegendBlock(ctx, doc, legend, notes, fonts, side, options.orientation === 'portrait' ? 2 : 1);
  }
  return pdf.save();
}

function drawHeader(ctx: Ctx, project: Project, plan: Plan, o: PlanPdfOptions, fonts: Fonts, box: Box) {
  let x = box.x;
  if (o.includeLogo) {
    drawLogo(ctx, box.x, box.y, box.h * 0.9);
    x += box.h * 0.9 + mmToPt(4);
  }
  const right = box.x + box.w;
  drawText(ctx, o.title || 'Plan électrique', x, box.y + mmToPt(6), { font: fonts.bold, size: 14, maxWidth: right - x - mmToPt(60) });
  const infos: string[] = [];
  if (o.showProjectName) infos.push(project.name);
  if (o.showClient && project.clientName) infos.push(`Client : ${project.clientName}`);
  if (o.showAddress && (project.address || project.city)) infos.push([project.address, project.city].filter(Boolean).join(', '));
  drawText(ctx, infos.join('  ·  '), x, box.y + mmToPt(11.5), { font: fonts.regular, size: 9, color: GRAY, maxWidth: right - x - mmToPt(60) });
  drawText(ctx, plan.name, right, box.y + mmToPt(6), { font: fonts.bold, size: 12, align: 'right', color: ORANGE });
  const date = o.showDate ? formatDate(project.date || Date.now()) : '';
  const scaleTxt = plan.scale?.pixelsPerMeter ? 'Échelle approximative' : '';
  drawText(ctx, [date, scaleTxt].filter(Boolean).join('  ·  '), right, box.y + mmToPt(11.5), { font: fonts.regular, size: 9, color: GRAY, align: 'right' });
  drawLine(ctx, box.x, box.y + box.h, right, box.y + box.h, ORANGE, 1.2);
}

function drawFooter(ctx: Ctx, fonts: Fonts, box: Box, n: number, total: number) {
  drawLine(ctx, box.x, box.y, box.x + box.w, box.y, LIGHT_GRAY, 0.6);
  drawText(
    ctx,
    'MG Elec & Plans — Plan simplifié destiné à l’implantation électrique. Document indicatif : validation par l’électricien.',
    box.x,
    box.y + mmToPt(4.5),
    {
      font: fonts.regular,
      size: 7,
      color: GRAY,
      maxWidth: box.w - mmToPt(20),
    },
  );
  drawText(ctx, `${n} / ${total}`, box.x + box.w, box.y + mmToPt(4.5), { font: fonts.regular, size: 7, color: GRAY, align: 'right' });
}

/** Emprise du contenu vectoriel (murs, symboles, annotations). */
function contentBounds(doc: PlanDocument) {
  const b = emptyBounds();
  for (const w of doc.walls) {
    extendBounds(b, w.x1, w.y1, w.thickness);
    extendBounds(b, w.x2, w.y2, w.thickness);
  }
  for (const s of doc.symbols) extendBounds(b, s.x, s.y, symbolWorldSize(getSymbolDefinition(s.symbolType), s.scale));
  for (const r of doc.rooms) extendBounds(b, r.x, r.y, 60);
  for (const a of doc.annotations) {
    if (a.points) for (let i = 0; i < a.points.length; i += 2) extendBounds(b, a.points[i], a.points[i + 1], 10);
    else {
      extendBounds(b, a.x, a.y, 10);
      extendBounds(b, a.x + (a.width ?? (a.text?.length ?? 4) * (a.fontSize ?? 20) * 0.6), a.y + (a.height ?? a.fontSize ?? 20), 10);
    }
  }
  for (const mm of doc.measures) {
    extendBounds(b, mm.x1, mm.y1, 20);
    extendBounds(b, mm.x2, mm.y2, 20);
  }
  return b;
}

async function drawPlan(pdf: PDFDocument, ctx: Ctx, plan: Plan, doc: PlanDocument, o: PlanPdfOptions, fonts: Fonts, box: Box) {
  const bg = o.showOriginal ? (plan.processedImage ?? plan.originalImage) : undefined;
  // Cadre de référence : image entière si affichée, sinon emprise du contenu
  let src = { x: 0, y: 0, w: plan.width, h: plan.height };
  if (!bg) {
    const b = contentBounds(doc);
    if (isBoundsValid(b)) {
      const pad = 20;
      src = { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + 2 * pad, h: b.maxY - b.minY + 2 * pad };
    }
  }
  const k = Math.min(box.w / src.w, box.h / src.h);
  const ox = box.x + (box.w - src.w * k) / 2 - src.x * k;
  const oy = box.y + (box.h - src.h * k) / 2 - src.y * k;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;

  if (bg) {
    try {
      const img = await dataUrlToEmbeddable(bg);
      const embedded = img.type === 'png' ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
      ctx.page.drawImage(embedded, { x: X(0), y: ctx.H - Y(plan.height), width: plan.width * k, height: plan.height * k, opacity: plan.backgroundOpacity });
    } catch (e) {
      console.warn('Image de fond non intégrée', e);
    }
  }

  if (o.showReconstructed) {
    const wallColor = hexToRgb('#374151');
    for (const w of doc.walls) drawLine(ctx, X(w.x1), Y(w.y1), X(w.x2), Y(w.y2), wallColor, Math.max(0.5, w.thickness * k), 'square');
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    for (const d of doc.doors) {
      const w = walls.get(d.wallId);
      if (!w) continue;
      const g = doorGeometry(w, d.t, d.width, d.flip, d.hingeEnd);
      drawLine(ctx, X(g.a.x), Y(g.a.y), X(g.b.x), Y(g.b.y), WHITE, (w.thickness + 2) * k);
      drawLine(ctx, X(g.hinge.x), Y(g.hinge.y), X(g.leafEnd.x), Y(g.leafEnd.y), wallColor, Math.max(0.6, 2.5 * k));
      const r = g.width * k;
      drawPath(ctx, `M${X(g.arcStart.x)} ${Y(g.arcStart.y)} A${r} ${r} 0 0 ${g.clockwise ? 1 : 0} ${X(g.leafEnd.x)} ${Y(g.leafEnd.y)}`, {
        stroke: wallColor,
        width: Math.max(0.4, 1.2 * k),
        dash: [3, 2],
      });
    }
    const winColor = hexToRgb('#0369a1');
    for (const win of doc.windows) {
      const w = walls.get(win.wallId);
      if (!w) continue;
      const f = openingFrame(w, win.t, win.width);
      drawLine(ctx, X(f.a.x), Y(f.a.y), X(f.b.x), Y(f.b.y), WHITE, w.thickness * k);
      const off = w.thickness / 4;
      for (const s of [off, -off])
        drawLine(ctx, X(f.a.x + f.n.x * s), Y(f.a.y + f.n.y * s), X(f.b.x + f.n.x * s), Y(f.b.y + f.n.y * s), winColor, Math.max(0.4, 1.6 * k));
    }
    const roomSize = Math.max(6, Math.min(14, (Math.max(plan.width, plan.height) / 80) * 1.1 * k));
    for (const r of doc.rooms) drawText(ctx, r.name, X(r.x), Y(r.y) + roomSize * 0.35, { font: fonts.bold, size: roomSize, color: GRAY, align: 'center' });
  }

  if (o.showConnections) {
    const byId = new Map(doc.symbols.map((s) => [s.id, s]));
    const labelledGroups = new Set<number>();
    for (const c of doc.connections) {
      const s = byId.get(c.sourceId);
      const t = byId.get(c.targetId);
      if (!s || !t) continue;
      const curve = connectionGeometry(c, s, t);
      const pc = {
        p0: { x: X(curve.p0.x), y: Y(curve.p0.y) },
        c1: { x: X(curve.c1.x), y: Y(curve.c1.y) },
        c2: { x: X(curve.c2.x), y: Y(curve.c2.y) },
        p1: { x: X(curve.p1.x), y: Y(curve.p1.y) },
      };
      const width = Math.max(0.6, c.width * k * 1.2);
      drawPath(ctx, bezierToSvgPath(pc), { stroke: hexToRgb(c.color), width, dash: dashPattern(c.dash, width), cap: 'round' });
      if (c.type === 'command' && c.showLabel && c.group !== undefined && !labelledGroups.has(c.group)) {
        labelledGroups.add(c.group);
        const mid = bezierPoint(pc, 0.5);
        const label = `Commande ${c.group}`;
        const fs = 5.5;
        const tw = fonts.bold.widthOfTextAtSize(label, fs) + 4;
        ctx.page.drawRectangle({
          x: mid.x - tw / 2,
          y: ctx.H - mid.y - 4.5,
          width: tw,
          height: 9,
          color: WHITE,
          borderColor: hexToRgb(c.color),
          borderWidth: 0.5,
        });
        drawText(ctx, label, mid.x, mid.y + 2, { font: fonts.bold, size: fs, color: hexToRgb(c.color), align: 'center' });
      }
    }
  }

  for (const s of doc.symbols) {
    const def = getSymbolDefinition(s.symbolType);
    const unit = symbolUnitScale(def, s.scale) * k;
    const color = s.properties.color ?? def.color;
    drawSymbolPrimitives(ctx, def.shapes, color, X(s.x), Y(s.y), s.rotation, unit, fonts);
    if (s.properties.label) {
      const size = symbolWorldSize(def, s.scale) * k;
      drawText(ctx, s.properties.label, X(s.x), Y(s.y) + size * 0.52 + Math.max(4, size * 0.32), {
        font: fonts.bold,
        size: Math.max(4, size * 0.32),
        color: hexToRgb(color),
        align: 'center',
      });
    }
  }

  if (o.showAnnotations) {
    for (const a of doc.annotations) {
      const col = hexToRgb(a.color);
      const sw = Math.max(0.5, a.strokeWidth * k);
      if (a.kind === 'text') {
        const fs = Math.max(4, (a.fontSize ?? 22) * k);
        drawText(ctx, a.text ?? '', X(a.x), Y(a.y) + fs * 0.8, { font: fonts.bold, size: fs, color: col });
      } else if (a.kind === 'rect') {
        drawPath(ctx, `M${X(a.x)} ${Y(a.y)}H${X(a.x + (a.width ?? 0))}V${Y(a.y + (a.height ?? 0))}H${X(a.x)}Z`, { stroke: col, width: sw });
      } else if (a.kind === 'circle') {
        ctx.page.drawEllipse({
          x: X(a.x + (a.width ?? 0) / 2),
          y: ctx.H - Y(a.y + (a.height ?? 0) / 2),
          xScale: ((a.width ?? 0) / 2) * k,
          yScale: ((a.height ?? 0) / 2) * k,
          borderColor: col,
          borderWidth: sw,
        });
      } else if (a.points && a.points.length >= 4) {
        const pts = a.points;
        let d = `M${X(pts[0])} ${Y(pts[1])}`;
        for (let i = 2; i < pts.length; i += 2) d += `L${X(pts[i])} ${Y(pts[i + 1])}`;
        drawPath(ctx, d, { stroke: col, width: sw, cap: 'round' });
        if (a.kind === 'arrow') {
          const n = pts.length;
          const x2 = X(pts[n - 2]);
          const y2 = Y(pts[n - 1]);
          const ang = Math.atan2(y2 - Y(pts[n - 3]), x2 - X(pts[n - 4]));
          const L = sw * 5;
          const Wd = sw * 2;
          const bx = x2 - Math.cos(ang) * L;
          const by = y2 - Math.sin(ang) * L;
          drawPath(ctx, `M${x2} ${y2}L${bx - Math.sin(ang) * Wd} ${by + Math.cos(ang) * Wd}L${bx + Math.sin(ang) * Wd} ${by - Math.cos(ang) * Wd}Z`, {
            fill: col,
          });
        }
      }
    }
  }

  if (o.showMeasures) {
    const col = hexToRgb('#0f766e');
    for (const mm of doc.measures) {
      drawLine(ctx, X(mm.x1), Y(mm.y1), X(mm.x2), Y(mm.y2), col, 0.8);
      const len = distance({ x: mm.x1, y: mm.y1 }, { x: mm.x2, y: mm.y2 });
      const txt = doc.scale?.pixelsPerMeter ? formatMeters(len / doc.scale.pixelsPerMeter) : '';
      if (!txt) continue;
      let ang = (Math.atan2(mm.y2 - mm.y1, mm.x2 - mm.x1) * 180) / Math.PI;
      if (ang > 90 || ang < -90) ang += 180;
      drawText(ctx, txt, X((mm.x1 + mm.x2) / 2), Y((mm.y1 + mm.y2) / 2) - 2, { font: fonts.bold, size: 7, color: col, align: 'center', rotation: ang });
    }
  }
}

function drawLegendBlock(ctx: Ctx, doc: PlanDocument, legend: ReturnType<typeof buildLegend>, notes: string, fonts: Fonts, box: Box, columns: number) {
  ctx.page.drawRectangle({ x: box.x, y: ctx.H - box.y - box.h, width: box.w, height: box.h, borderColor: LIGHT_GRAY, borderWidth: 0.8, color: WHITE });
  const pad = mmToPt(3);
  let y = box.y + pad + 8;
  const colW = (box.w - pad * 2) / columns;
  if (legend.length) {
    drawText(ctx, 'LÉGENDE', box.x + pad, y, { font: fonts.bold, size: 9, color: BLACK });
    y += mmToPt(3);
    const rowH = mmToPt(5.2);
    const icon = mmToPt(4.2);
    const rows = Math.ceil(legend.length / columns);
    legend.forEach((e, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const cx = box.x + pad + col * colW;
      const cy = y + row * rowH + rowH / 2;
      if (cy + rowH / 2 > box.y + box.h - pad) return;
      drawSymbolPrimitives(ctx, e.def.shapes, e.def.color, cx + icon / 2, cy, 0, icon / 40, fonts);
      drawText(ctx, `${e.def.name}  (${e.count})`, cx + icon + mmToPt(2), cy + 2.5, { font: fonts.regular, size: 7, maxWidth: colW - icon - mmToPt(3) });
    });
    y += rows * rowH + mmToPt(1);
    const types: [string, string, string][] = [];
    if (doc.connections.some((c) => c.type === 'command')) types.push(['#f97316', 'dash', 'Liaison de commande']);
    if (doc.connections.some((c) => c.type === 'circuit')) types.push(['#2563eb', 'long', 'Liaison de circuit']);
    if (doc.connections.some((c) => c.type === 'information')) types.push(['#6b7280', 'dot', 'Information']);
    for (const [color, dash, label] of types) {
      if (y + mmToPt(4) > box.y + box.h - pad) break;
      drawPath(ctx, `M${box.x + pad} ${y + 3} L${box.x + pad + icon} ${y + 3}`, {
        stroke: hexToRgb(color),
        width: 1.2,
        dash: dashPattern(dash as 'dash', 1.2),
        cap: 'round',
      });
      drawText(ctx, label, box.x + pad + icon + mmToPt(2), y + 5, { font: fonts.regular, size: 7 });
      y += mmToPt(4.5);
    }
  }
  if (notes && y + mmToPt(8) < box.y + box.h) {
    y += mmToPt(2);
    drawText(ctx, 'NOTES', box.x + pad, y + 6, { font: fonts.bold, size: 9 });
    y += mmToPt(5);
    for (const line of wrapText(fonts.regular, notes, 7.5, box.w - pad * 2)) {
      if (y + 8 > box.y + box.h - pad) break;
      drawText(ctx, line, box.x + pad, y + 6, { font: fonts.regular, size: 7.5, color: GRAY });
      y += 10;
    }
  }
}
