import { memo, type ReactNode } from 'react';
import type { Brand, DeviceProduct } from '../types';
import { SCHEMA_DEVICE_H } from '../engine/schemaGeometry';

/**
 * Appareil vu de face pour la vue « Schéma tableau » (hauteur complète, bornes
 * visibles). Chaque fabricant a son propre dessin, inspiré de ses produits :
 * Legrand (DNX³ / DX³-ID : bandeau bleu translucide, manette noire, voyant
 * « I-ON »), Schneider (Resi9 XP : calibre en haut, manette anthracite),
 * Hager (cadre gris, manette sombre, calibre en bas, référence imprimée).
 */

const H = SCHEMA_DEVICE_H;
const FONT = 'Helvetica, Arial, sans-serif';
const TOP_BAND = 15;
const BOTTOM_BAND = 15;

interface Props {
  product: DeviceProduct;
  width: number;
  uid: string;
}

function T({ x, y, size, children, color = '#16181b', weight = 700, anchor = 'middle', rotate }: { x: number; y: number; size: number; children: ReactNode; color?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; rotate?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={FONT} fontWeight={weight} textAnchor={anchor} fill={color} transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
      {children}
    </text>
  );
}

/** Définitions partagées (dégradés) de la vue schéma. */
export function SchemaDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <radialGradient id={`${uid}-screw`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#c3c8cd" />
        <stop offset="1" stopColor="#8a9098" />
      </radialGradient>
      <linearGradient id={`${uid}-lgband`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e3f0fa" />
        <stop offset="0.55" stopColor="#bcd9f1" />
        <stop offset="1" stopColor="#9cc4e6" />
      </linearGradient>
      <linearGradient id={`${uid}-black`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4e54" />
        <stop offset="0.25" stopColor="#1b1d20" />
        <stop offset="1" stopColor="#0d0e10" />
      </linearGradient>
      <linearGradient id={`${uid}-anth`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6a727b" />
        <stop offset="1" stopColor="#2e3339" />
      </linearGradient>
      <radialGradient id={`${uid}-socket`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d6d9dc" />
      </radialGradient>
      <pattern id={`${uid}-hatch`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="#c9ccd0" />
        <line x1="0" y1="0" x2="0" y2="4" stroke="#b1b5ba" strokeWidth="1.4" />
      </pattern>
    </defs>
  );
}

function Screw({ cx, cy, uid, r = 2.3 }: { cx: number; cy: number; uid: string; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-screw)`} stroke="#5f666e" strokeWidth={0.3} />
      <path d={`M${cx - r * 0.62} ${cy + r * 0.62}L${cx + r * 0.62} ${cy - r * 0.62}`} stroke="#4b5159" strokeWidth={0.45} />
    </g>
  );
}

/** Bandeau de bornes (haut ou bas) propre à chaque marque. */
function Terminals({ brand, w, y, h, uid, count, showN }: { brand: Brand; w: number; y: number; h: number; uid: string; count: number; showN: boolean }) {
  const xs = Array.from({ length: count }, (_, i) => (w * (i + 0.5)) / count);
  const cy = y + h * 0.58;
  return (
    <g>
      <rect x={0.4} y={y} width={w - 0.8} height={h} fill={brand === 'hager' ? '#ececeb' : brand === 'schneider' ? '#eef0f1' : '#f3f4f5'} />
      {brand === 'schneider' && xs.map((x, i) => <rect key={`o${i}`} x={x - Math.min(3.2, w / count / 2 - 0.8)} y={cy + 2.6} width={Math.min(6.4, w / count - 1.6)} height={2} rx={0.5} fill="#3a3f45" />)}
      {brand === 'hager' && xs.map((x, i) => <rect key={`s${i}`} x={x - 3.4} y={cy - 3.4} width={6.8} height={6.8} rx={1.2} fill="#d5d8db" stroke="#aeb3b8" strokeWidth={0.25} />)}
      {xs.map((x, i) => (
        <Screw key={i} cx={x} cy={cy} uid={uid} r={Math.min(2.4, w / count / 2 - 1.1)} />
      ))}
      {showN && (
        <T x={xs[0]} y={y + 3.4} size={2.4} weight={700} color="#374151">
          N
        </T>
      )}
    </g>
  );
}

/** Marque imprimée sur la face (texte simple, pas de logo). */
function BrandMark({ brand, x, y, anchor = 'start' }: { brand: Brand; x: number; y: number; anchor?: 'start' | 'middle' | 'end' }) {
  if (brand === 'legrand')
    return (
      <T x={x} y={y} size={1.9} weight={700} color="#374151" anchor={anchor}>
        legrand
      </T>
    );
  if (brand === 'schneider')
    return (
      <T x={x} y={y} size={1.5} weight={700} color="#2f9e44" anchor={anchor}>
        Schneider
      </T>
    );
  return (
    <T x={x} y={y} size={2} weight={700} color="#2b4f7e" anchor={anchor}>
      hager
    </T>
  );
}

/** Manette noire Legrand (arche) avec voyant rouge « I-ON ». */
function LegrandToggle({ x, w, uid, red = false }: { x: number; w: number; uid: string; red?: boolean }) {
  const top = 31;
  const bottom = 55;
  return (
    <g>
      <path
        d={`M${x} ${bottom}V${top + 7}Q${x} ${top} ${x + 7} ${top}H${x + w - 7}Q${x + w} ${top} ${x + w} ${top + 7}V${bottom}Z`}
        fill={red ? '#d32f2f' : `url(#${uid}-black)`}
      />
      <rect x={x + 1.6} y={top + 1.4} width={w - 3.2} height={2.2} rx={1.1} fill="#ffffff" opacity={red ? 0.35 : 0.18} />
      <rect x={x + w * 0.18} y={bottom - 5.6} width={w * 0.64} height={4.2} rx={0.6} fill={red ? '#ffffff' : '#c62828'} />
      <T x={x + w / 2} y={bottom - 2.5} size={2} weight={700} color={red ? '#c62828' : '#ffffff'}>
        I-ON
      </T>
    </g>
  );
}

/** Manette sombre dans un cadre (Schneider / Hager). */
function FramedToggle({ brand, x, w, uid, red = false }: { brand: Brand; x: number; w: number; uid: string; red?: boolean }) {
  const top = brand === 'schneider' ? 27 : 26;
  const h = 27;
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx={brand === 'schneider' ? 4 : 2.6} fill={brand === 'schneider' ? '#cfd5da' : '#d4d7da'} stroke="#9aa1a8" strokeWidth={0.3} />
      <rect x={x + 1.6} y={top + 1.6} width={w - 3.2} height={h * 0.52} rx={brand === 'schneider' ? 3.2 : 2} fill={red ? '#d32f2f' : `url(#${uid}-anth)`} />
      <rect x={x + 2.6} y={top + 2.4} width={w - 5.2} height={1.4} rx={0.7} fill="#ffffff" opacity={0.3} />
      <T x={x + w / 2} y={top + h - 3.2} size={2.2} weight={700} color="#4b5563">
        O
      </T>
    </g>
  );
}

function Led({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={1.25} fill={color} stroke="#00000033" strokeWidth={0.2} />
      <circle cx={cx - 0.35} cy={cy - 0.35} r={0.4} fill="#fff" opacity={0.7} />
    </g>
  );
}

function RatingBox({ x, y, w, text, brand }: { x: number; y: number; w: number; text: string; brand: Brand }) {
  const size = Math.min(7.4, (w - 2) / (text.length * 0.56));
  return (
    <g>
      {brand === 'legrand' && <rect x={x} y={y} width={w} height={11} fill="#ffffff" stroke="#d1d5db" strokeWidth={0.25} />}
      <T x={x + w / 2} y={y + 8.2} size={size} weight={brand === 'legrand' ? 400 : 700}>
        {text}
      </T>
      {brand === 'legrand' && <path d={`M${x + 1.2} ${y + 2}V${y + 9.6}H${x + w * 0.5}`} stroke="#d32f2f" strokeWidth={0.5} fill="none" />}
    </g>
  );
}

function SocketFace({ brand, w, uid }: { brand: Brand; w: number; uid: string }) {
  const cx = w / 2;
  const cy = 44;
  const r = Math.min(w * 0.36, 16);
  return (
    <g>
      {brand === 'legrand' && <rect x={cx - r - 4} y={cy - r - 4} width={(r + 4) * 2} height={(r + 4) * 2} rx={4} fill="#ffffff" stroke="#c9ccd0" strokeWidth={0.35} />}
      {brand === 'schneider' && <rect x={cx - r - 4.5} y={cy - r - 3} width={(r + 4.5) * 2} height={(r + 3) * 2} rx={9} fill="#f7f8f9" stroke="#b9c0c7" strokeWidth={0.35} />}
      {brand === 'hager' && <circle cx={cx} cy={cy} r={r + 3.5} fill="#cdcac0" stroke="#aaa699" strokeWidth={0.35} />}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-socket)`} stroke="#9aa0a6" strokeWidth={0.4} />
      <circle cx={cx} cy={cy} r={r - 3} fill="#f2f3f4" stroke="#c3c7cb" strokeWidth={0.3} />
      <circle cx={cx - r * 0.36} cy={cy + 1} r={1.8} fill="#1f2328" />
      <circle cx={cx + r * 0.36} cy={cy + 1} r={1.8} fill="#1f2328" />
      <rect x={cx - 1.2} y={cy - r + 3.4} width={2.4} height={4} rx={0.8} fill="#e8e0a8" stroke="#9c9366" strokeWidth={0.3} />
    </g>
  );
}

/** Corps commun : contour, face, bandeaux de bornes et marque. */
function Body({
  brand,
  w,
  uid,
  terminalsTop = true,
  terminalsBottom = true,
  children,
  face,
  terminals,
  band = true,
}: {
  brand: Brand;
  w: number;
  uid: string;
  terminalsTop?: boolean;
  terminalsBottom?: boolean;
  children: ReactNode;
  face?: string;
  /** Nombre de bornes (sinon 2 par module). */
  terminals?: number;
  /** Bandeau de marque sous les bornes du haut. */
  band?: boolean;
}) {
  const count = terminals ?? Math.max(2, Math.round(w / 9));
  const faceColor = face ?? (brand === 'hager' ? '#fbfaf6' : brand === 'schneider' ? '#fafbfb' : '#ffffff');
  return (
    <g>
      <rect x={0.3} y={0} width={w - 0.6} height={H} rx={1} fill={faceColor} stroke="#6b7280" strokeWidth={0.35} />
      {terminalsTop && <Terminals brand={brand} w={w} y={0} h={TOP_BAND} uid={uid} count={count} showN />}
      {terminalsBottom && <Terminals brand={brand} w={w} y={H - BOTTOM_BAND} h={BOTTOM_BAND} uid={uid} count={count} showN />}
      {band && brand === 'legrand' && terminalsTop && <rect x={0.4} y={TOP_BAND} width={w - 0.8} height={14} fill={`url(#${uid}-lgband)`} />}
      {band && brand === 'schneider' && <rect x={0.4} y={TOP_BAND} width={w - 0.8} height={9} fill="#dfe3e6" />}
      {band && brand === 'hager' && <rect x={0.4} y={TOP_BAND} width={w - 0.8} height={9} fill="#e5e6e7" />}
      {brand === 'schneider' && <rect x={0.4} y={H - BOTTOM_BAND - 1.1} width={w - 0.8} height={0.8} fill="#3dcd58" />}
      {children}
      <rect x={0.3} y={0} width={w - 0.6} height={H} rx={1} fill="none" stroke="#6b7280" strokeWidth={0.35} />
    </g>
  );
}

function Breaker({ product: p, width: w, uid }: Props) {
  const b = p.brand;
  const rating = `${p.rating}A`;
  const curveRating = `${p.curve ?? ''}${p.rating}`;
  if (b === 'legrand')
    return (
      <Body brand={b} w={w} uid={uid}>
        <LegrandToggle x={2} w={w - 4} uid={uid} />
        <RatingBox x={1} y={57} w={w - 2} text={rating} brand={b} />
        <BrandMark brand={b} x={2.2} y={69.4} />
      </Body>
    );
  if (b === 'schneider')
    return (
      <Body brand={b} w={w} uid={uid}>
        <T x={w / 2} y={TOP_BAND + 6.8} size={Math.min(5.6, w / 3.6)}>
          {curveRating}
        </T>
        <FramedToggle brand={b} x={w * 0.18} w={w * 0.64} uid={uid} />
        <rect x={w / 2 - 3} y={57} width={6} height={2.6} rx={0.6} fill="#d32f2f" />
        <BrandMark brand={b} x={w / 2} y={64.5} anchor="middle" />
        <T x={w / 2} y={67.6} size={1.5} weight={400} color="#6b7280">
          Resi9
        </T>
      </Body>
    );
  return (
    <Body brand={b} w={w} uid={uid}>
      {p.reference && (
        <T x={w / 2} y={TOP_BAND + 5.8} size={1.9} weight={400} color="#4b5563">
          {p.reference}
        </T>
      )}
      <FramedToggle brand={b} x={w * 0.14} w={w * 0.72} uid={uid} />
      <T x={w / 2} y={62.5} size={Math.min(5.6, w / 3.6)}>
        {curveRating}
      </T>
      <BrandMark brand={b} x={w / 2} y={67.8} anchor="middle" />
    </Body>
  );
}

function Rcd({ product: p, width: w, uid }: Props) {
  const b = p.brand;
  const half = w / 2;
  const type = p.rcdType ?? '';
  if (b === 'legrand')
    return (
      <Body brand={b} w={w} uid={uid}>
        <LegrandToggle x={2} w={half - 2.5} uid={uid} />
        <T x={half + half / 2} y={39} size={3.4} weight={400}>
          30mA
        </T>
        <T x={half + half / 2} y={43} size={2.1} weight={400} color="#374151">
          {`Type ${type}`}
        </T>
        <RatingBox x={1} y={57} w={half + 1} text={`${p.rating}A`} brand={b} />
        <rect x={half + 3} y={60} width={half - 6} height={5} fill="#c8ccd0" stroke="#8d949b" strokeWidth={0.3} />
        <T x={half + half / 2} y={64} size={3} color="#111827">
          T
        </T>
        <BrandMark brand={b} x={2.2} y={69.4} />
      </Body>
    );
  if (b === 'schneider')
    return (
      <Body brand={b} w={w} uid={uid}>
        <T x={w / 2} y={TOP_BAND + 6.8} size={4.4}>{`ID ${p.rating}A`}</T>
        <FramedToggle brand={b} x={3} w={half - 4} uid={uid} />
        <circle cx={half + half / 2} cy={33} r={3.4} fill="#aab4be" stroke="#6b7280" strokeWidth={0.3} />
        <T x={half + half / 2} y={34.3} size={3.2}>
          T
        </T>
        <T x={half + half / 2} y={44} size={3} weight={400}>
          30mA
        </T>
        <rect x={half + half / 2 - 4} y={46.5} width={8} height={5} rx={0.6} fill="#fff" stroke="#1f2937" strokeWidth={0.3} />
        <T x={half + half / 2} y={50.5} size={3}>
          {type}
        </T>
        <BrandMark brand={b} x={w / 2} y={64.5} anchor="middle" />
      </Body>
    );
  return (
    <Body brand={b} w={w} uid={uid}>
      {p.reference && (
        <T x={w / 2} y={TOP_BAND + 5.8} size={1.9} weight={400} color="#4b5563">
          {p.reference}
        </T>
      )}
      <FramedToggle brand={b} x={2.4} w={half - 3.4} uid={uid} />
      <circle cx={half + half / 2} cy={32} r={3.4} fill="#2f6fad" stroke="#1e3a5f" strokeWidth={0.3} />
      <T x={half + half / 2} y={33.3} size={3.2} color="#fff">
        T
      </T>
      <T x={half + half / 2} y={43} size={3} weight={400}>
        30mA
      </T>
      <rect x={half + half / 2 - 4} y={45.5} width={8} height={5} rx={0.6} fill="#fff" stroke="#1f2937" strokeWidth={0.3} />
      <T x={half + half / 2} y={49.5} size={3}>
        {type}
      </T>
      <T x={half / 2 + 1} y={62.5} size={5}>{`${p.rating}A`}</T>
      <BrandMark brand={b} x={w - 2} y={67.8} anchor="end" />
    </Body>
  );
}

function Isolator({ product: p, width: w, uid }: Props) {
  const b = p.brand;
  const half = w / 2;
  return (
    <Body brand={b} w={w} uid={uid}>
      {b === 'legrand' ? (
        <>
          <LegrandToggle x={2} w={half - 2.5} uid={uid} red />
          <LegrandToggle x={half + 0.5} w={half - 2.5} uid={uid} red />
        </>
      ) : (
        <>
          <FramedToggle brand={b} x={2.4} w={half - 3.4} uid={uid} red />
          <FramedToggle brand={b} x={half + 1} w={half - 3.4} uid={uid} red />
        </>
      )}
      <T x={w / 2} y={63} size={4.4}>{`${p.rating}A`}</T>
      <BrandMark brand={b} x={w / 2} y={68.4} anchor="middle" />
    </Body>
  );
}

function Generic({ product: p, width: w, uid, children, label }: Props & { children: ReactNode; label?: string }) {
  const b = p.brand;
  return (
    <Body brand={b} w={w} uid={uid}>
      {label && (
        <T x={w / 2} y={TOP_BAND + 6.6} size={Math.min(3.6, w / 5)}>
          {label}
        </T>
      )}
      {children}
      <BrandMark brand={b} x={w / 2} y={68} anchor="middle" />
    </Body>
  );
}

export const SchemaDevice = memo(function SchemaDevice(props: Props) {
  const { product: p, width: w, uid } = props;
  const b = p.brand;
  const cx = w / 2;
  switch (p.kind) {
    case 'breaker':
      return <Breaker {...props} />;
    case 'rcd':
      return <Rcd {...props} />;
    case 'isolator':
      return <Isolator {...props} />;
    case 'socket':
      return (
        <Body brand={b} w={w} uid={uid} terminalsBottom={false} face={b === 'hager' ? '#d9d6cc' : undefined} terminals={3} band={false}>
          <SocketFace brand={b} w={w} uid={uid} />
          <T x={cx} y={70} size={2.6}>{`${p.rating ?? 16}A`}</T>
          <BrandMark brand={b} x={cx} y={74} anchor="middle" />
        </Body>
      );
    case 'teleruptor':
      return (
        <Generic {...props} label="TL">
          <rect x={cx - 5} y={30} width={10} height={12} rx={1.4} fill="#cfd4d9" stroke="#8d949b" strokeWidth={0.3} />
          <path d={`M${cx - 2.4} ${37.5}L${cx} ${33.5}L${cx + 2.4} ${37.5}Z`} fill="#4b5563" />
          <Led cx={cx} cy={48} color="#f59e0b" />
          <T x={cx} y={60} size={3.2}>{`${p.rating ?? 16}A`}</T>
        </Generic>
      );
    case 'contactor-hc':
    case 'contactor':
      return (
        <Generic {...props} label={p.kind === 'contactor-hc' ? 'HC' : 'CT'}>
          <rect x={cx - 3.6} y={29} width={7.2} height={17} rx={1.6} fill="#2f3439" />
          <rect x={cx - 2.8} y={29.8} width={5.6} height={6.5} rx={1} fill="#c7ccd1" />
          <T x={cx - 5.8} y={32} size={1.8} weight={400} color="#4b5563">I</T>
          <T x={cx - 5.8} y={38} size={1.8} weight={400} color="#4b5563">A</T>
          <T x={cx - 5.8} y={44} size={1.8} weight={400} color="#4b5563">0</T>
          <Led cx={cx} cy={51} color="#22c55e" />
          <T x={cx} y={61} size={3.2}>{`${p.rating ?? ''}A`}</T>
        </Generic>
      );
    case 'spd':
      return (
        <Generic {...props} label="SPD">
          <rect x={w * 0.25 - 3} y={30} width={6} height={10} rx={1} fill="#2f3439" />
          <rect x={w * 0.25 - 2.2} y={30.8} width={4.4} height={8.4} rx={0.6} fill="#22c55e" />
          <path d={`M${w * 0.68 - 3.4} 38H${w * 0.68 + 3.4}M${w * 0.68 - 2.2} 40H${w * 0.68 + 2.2}M${w * 0.68 - 1} 42H${w * 0.68 + 1}M${w * 0.68} 32V38`} stroke="#1f2937" strokeWidth={0.6} fill="none" />
          <T x={cx} y={58} size={2.6}>Parafoudre</T>
        </Generic>
      );
    case 'timer':
      return (
        <Generic {...props} label="MIN">
          <circle cx={cx} cy={38} r={5.2} fill={`url(#${uid}-screw)`} stroke="#6b7280" strokeWidth={0.3} />
          <rect x={cx - 0.4} y={33.5} width={0.8} height={4.6} fill="#1f2937" />
          <Led cx={cx} cy={50} color="#f59e0b" />
        </Generic>
      );
    case 'clock':
      return (
        <Generic {...props} label="HORLOGE">
          <rect x={3} y={28} width={w - 6} height={11} rx={0.8} fill="#2f3439" />
          <rect x={3.8} y={28.8} width={w - 7.6} height={9.4} rx={0.5} fill="#b9d58f" />
          <T x={cx} y={35.6} size={4} color="#1f2a14">
            12:00
          </T>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={4 + i * ((w - 8) / 4)} y={44} width={(w - 8) / 4 - 1.2} height={4.5} rx={1} fill="#4b5563" />
          ))}
        </Generic>
      );
    case 'relay':
      return (
        <Generic {...props} label="REL">
          <rect x={cx - 2.6} y={30} width={5.2} height={10} rx={1} fill="#2f3439" />
          <rect x={cx - 1.9} y={30.7} width={3.8} height={4.4} rx={0.8} fill="#c7ccd1" />
          <Led cx={cx} cy={47} color="#ef4444" />
        </Generic>
      );
    case 'load-shedder':
      return (
        <Generic {...props} label="DÉLEST.">
          <Led cx={w * 0.3} cy={31} color="#22c55e" />
          <Led cx={w * 0.5} cy={31} color="#f59e0b" />
          <Led cx={w * 0.7} cy={31} color="#ef4444" />
          <circle cx={cx} cy={43} r={4.6} fill={`url(#${uid}-screw)`} stroke="#6b7280" strokeWidth={0.3} />
        </Generic>
      );
    case 'heating-control':
      return (
        <Generic {...props} label="FIL PILOTE">
          <Led cx={w * 0.22} cy={31} color="#ef4444" />
          <Led cx={w * 0.41} cy={31} color="#f59e0b" />
          <Led cx={w * 0.6} cy={31} color="#22c55e" />
          <Led cx={w * 0.79} cy={31} color="#3b82f6" />
          <rect x={cx - 3.6} y={36} width={7.2} height={14} rx={1.6} fill="#2f3439" />
          <rect x={cx - 2.8} y={36.8} width={5.6} height={5} rx={1} fill="#c7ccd1" />
        </Generic>
      );
    case 'energy-meter':
      return (
        <Generic {...props} label="kWh">
          <rect x={1.6} y={28} width={w - 3.2} height={9} rx={0.8} fill="#2f3439" />
          <rect x={2.3} y={28.7} width={w - 4.6} height={7.6} rx={0.5} fill="#b9d58f" />
          <T x={cx} y={34.4} size={3} color="#1f2a14">
            00123
          </T>
          <Led cx={cx} cy={44} color="#ef4444" />
        </Generic>
      );
    case 'domotic':
      return (
        <Generic {...props} label="DOMOTIQUE">
          <Led cx={w * 0.3} cy={31} color="#3b82f6" />
          <Led cx={w * 0.5} cy={31} color="#22c55e" />
          <Led cx={w * 0.7} cy={31} color="#f59e0b" />
          <rect x={cx - 4} y={37} width={8} height={6} rx={1.4} fill="#cfd4d9" stroke="#8d949b" strokeWidth={0.3} />
          <T x={cx} y={54} size={2.4} weight={400} color="#4b5563">
            BUS
          </T>
        </Generic>
      );
    case 'bell':
      return (
        <Generic {...props} label="SON">
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={cx - 4.5 + (i % 4) * 3} cy={31 + Math.floor(i / 4) * 3} r={0.8} fill="#4b5563" />
          ))}
        </Generic>
      );
    case 'bell-transformer':
      return (
        <Generic {...props} label="TRANSFO">
          <T x={cx} y={36} size={4}>
            8-12V
          </T>
          <path d={`M${cx - 5} 42q2.5 -3 5 0t5 0`} stroke="#1f2937" strokeWidth={0.7} fill="none" />
        </Generic>
      );
    case 'blank':
      return (
        <Body brand={b} w={w} uid={uid} terminalsTop={false} terminalsBottom={false}>
          {[20, 43, 66].map((y) => (
            <rect key={y} x={1.5} y={y} width={w - 3} height={0.6} fill="#d1d5db" />
          ))}
        </Body>
      );
    case 'reserve':
      return (
        <g>
          <rect x={0.3} y={0} width={w - 0.6} height={H} rx={1} fill={`url(#${uid}-hatch)`} stroke="#8d949b" strokeWidth={0.35} strokeDasharray="1.6 1" />
          <T x={cx + 1.4} y={H / 2} size={Math.min(3.6, w / 4)} color="#4b5563" rotate={-90}>
            RÉSERVE
          </T>
        </g>
      );
  }
  return null;
});
