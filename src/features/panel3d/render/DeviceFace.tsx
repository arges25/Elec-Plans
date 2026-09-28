import { memo, type ReactNode } from 'react';
import type { Brand, DeviceProduct } from '../types';
import { DEVICE_FACE_MM } from '../engine/geometry';

/**
 * Face avant d'un appareil modulaire, dessinée en millimètres (largeur réelle
 * en modules × hauteur visible à travers le capot). Chaque marque a sa propre
 * géométrie (manette, marquage, bouton test, témoin…) : pas d'appareil identique
 * recoloré.
 */

interface Props {
  product: DeviceProduct;
  /** Préfixe des dégradés définis par <BoardDefs>. */
  uid: string;
  width: number;
}

const H = DEVICE_FACE_MM;
const FONT = 'Helvetica, Arial, sans-serif';

function T({ x, y, size, children, color = '#16181b', weight = 700, anchor = 'middle' }: { x: number; y: number; size: number; children: ReactNode; color?: string; weight?: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={FONT} fontWeight={weight} textAnchor={anchor} fill={color}>
      {children}
    </text>
  );
}

/** Boîtier de base (face avant avec relief) propre à chaque marque. */
function Housing({ brand, uid, w }: { brand: Brand; uid: string; w: number }) {
  return (
    <g>
      <rect x={0.15} y={0} width={w - 0.3} height={H} rx={brand === 'schneider' ? 1.6 : 1} fill={`url(#${uid}-face-${brand})`} stroke="#8d949c" strokeWidth={0.25} />
      {/* Arête supérieure éclairée, arête inférieure dans l'ombre */}
      <rect x={0.5} y={0.4} width={w - 1} height={0.8} rx={0.4} fill="#ffffff" opacity={0.85} />
      <rect x={0.5} y={H - 1.1} width={w - 1} height={0.7} rx={0.35} fill="#000" opacity={0.08} />
      {brand === 'legrand' && <rect x={0.8} y={2} width={w - 1.6} height={6.5} rx={0.8} fill="#ffffff" opacity={0.55} />}
      {brand === 'hager' && <rect x={1.2} y={2} width={w - 2.4} height={2.6} rx={1.2} fill="#c9ccd0" />}
      {brand === 'schneider' && <rect x={1} y={H - 5.2} width={w - 2} height={0.6} rx={0.3} fill="#3dcd58" opacity={0.9} />}
    </g>
  );
}

/** Manette de commande, différente selon la marque (position ON). */
function Toggle({ brand, uid, cx }: { brand: Brand; uid: string; cx: number }) {
  if (brand === 'legrand')
    return (
      <g>
        <rect x={cx - 3.3} y={12} width={6.6} height={18} rx={1.2} fill="#2b2f34" />
        <rect x={cx - 2.7} y={12.8} width={5.4} height={9} rx={1.2} fill={`url(#${uid}-tog-legrand)`} />
        <rect x={cx - 2.1} y={13.4} width={4.2} height={1.2} rx={0.6} fill="#fff" opacity={0.35} />
        <T x={cx} y={11} size={1.9} weight={400} color="#555">I</T>
        <T x={cx} y={32.4} size={1.9} weight={400} color="#555">O</T>
      </g>
    );
  if (brand === 'schneider')
    return (
      <g>
        <rect x={cx - 4} y={13} width={8} height={16} rx={3.2} fill="#cfd6dd" stroke="#8b96a2" strokeWidth={0.3} />
        <rect x={cx - 3.4} y={13.6} width={6.8} height={9.4} rx={3} fill={`url(#${uid}-tog-schneider)`} />
        <ellipse cx={cx} cy={15.6} rx={2.4} ry={0.9} fill="#fff" opacity={0.45} />
        <rect x={cx - 1.6} y={31} width={3.2} height={2} rx={0.5} fill="#d62d2d" />
      </g>
    );
  return (
    <g>
      <rect x={cx - 4.2} y={10.5} width={8.4} height={21} rx={2.4} fill="#d9dcdf" stroke="#9aa0a6" strokeWidth={0.3} />
      <rect x={cx - 3.3} y={11.5} width={6.6} height={19} rx={1.8} fill="#3a3f45" />
      <rect x={cx - 2.7} y={12.2} width={5.4} height={8.6} rx={1.6} fill={`url(#${uid}-tog-hager)`} />
      <rect x={cx - 2} y={12.8} width={4} height={1} rx={0.5} fill="#fff" opacity={0.3} />
    </g>
  );
}

function TestButton({ brand, cx, cy }: { brand: Brand; cx: number; cy: number }) {
  const fill = brand === 'legrand' ? '#f2c230' : brand === 'schneider' ? '#9aa6b2' : '#2f6fad';
  const text = brand === 'hager' ? '#fff' : '#1b1d20';
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.2} fill="#00000022" />
      <circle cx={cx} cy={cy - 0.2} r={2.9} fill={fill} stroke="#6b7280" strokeWidth={0.25} />
      <T x={cx} y={cy + 0.9} size={2.6} color={text}>T</T>
    </g>
  );
}

function Led({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={1.2} fill={color} />
      <circle cx={cx - 0.35} cy={cy - 0.35} r={0.4} fill="#fff" opacity={0.7} />
    </g>
  );
}

function Knob({ uid, cx, cy, r }: { uid: string; cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy + 0.4} r={r} fill="#00000026" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-knob)`} stroke="#6b7280" strokeWidth={0.25} />
      <rect x={cx - 0.35} y={cy - r + 0.6} width={0.7} height={r * 0.9} rx={0.3} fill="#1f2937" />
    </g>
  );
}

function Selector({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 3} y={cy - 5} width={6} height={10} rx={1.5} fill="#2f3439" />
      <rect x={cx - 2.2} y={cy - 4.2} width={4.4} height={4} rx={1} fill="#c7ccd1" />
      <T x={cx - 4.6} y={cy - 2.6} size={1.6} weight={400} color="#555" anchor="middle">I</T>
      <T x={cx - 4.6} y={cy + 1} size={1.6} weight={400} color="#555" anchor="middle">A</T>
      <T x={cx - 4.6} y={cy + 4.4} size={1.6} weight={400} color="#555" anchor="middle">0</T>
    </g>
  );
}

function Lcd({ uid, x, y, w, h, text }: { uid: string; x: number; y: number; w: number; h: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={0.8} fill="#2f3439" />
      <rect x={x + 0.8} y={y + 0.8} width={w - 1.6} height={h - 1.6} rx={0.5} fill={`url(#${uid}-lcd)`} />
      <T x={x + w / 2} y={y + h / 2 + 1.1} size={Math.min(3, h * 0.45)} color="#1f2a14" weight={600}>
        {text}
      </T>
    </g>
  );
}

/** Prise de courant modulaire 2P+T (vue de face). */
function SocketFace({ brand, uid, w }: { brand: Brand; uid: string; w: number }) {
  const cx = w / 2;
  const cy = H / 2 + 1;
  return (
    <g>
      {brand === 'legrand' && <rect x={cx - 13.5} y={cy - 13.5} width={27} height={27} rx={3} fill="#ffffff" stroke="#c4c8cc" strokeWidth={0.35} />}
      {brand === 'hager' && <circle cx={cx} cy={cy} r={14.2} fill="#d5d8db" stroke="#9aa0a6" strokeWidth={0.3} />}
      {brand === 'schneider' && <rect x={cx - 14} y={cy - 12.5} width={28} height={25} rx={6} fill="#eef1f4" stroke="#aab3bc" strokeWidth={0.3} />}
      <circle cx={cx} cy={cy} r={11.5} fill={`url(#${uid}-socket)`} stroke="#8d949c" strokeWidth={0.3} />
      <circle cx={cx} cy={cy} r={9.6} fill="#f7f7f5" stroke="#b8bdc2" strokeWidth={0.25} />
      <circle cx={cx - 4} cy={cy} r={1.4} fill="#26292d" />
      <circle cx={cx + 4} cy={cy} r={1.4} fill="#26292d" />
      <rect x={cx - 1} y={cy - 9.4} width={2} height={3.6} rx={0.6} fill="#a6adb4" stroke="#6b7280" strokeWidth={0.2} />
      {brand === 'schneider' && <path d={`M${cx - 9} ${cy + 6}Q${cx} ${cy + 9.5} ${cx + 9} ${cy + 6}`} fill="none" stroke="#9aa4ae" strokeWidth={0.4} />}
    </g>
  );
}

export const DeviceFace = memo(function DeviceFace({ product, uid, width: w }: Props) {
  const b = product.brand;
  const cx = w / 2;
  let body: ReactNode = null;
  switch (product.kind) {
    case 'breaker':
      body = (
        <>
          <Toggle brand={b} uid={uid} cx={cx} />
          {b === 'hager' ? (
            <T x={cx} y={40.2} size={3.4}>{`${product.curve ?? ''}${product.rating ?? ''}`}</T>
          ) : (
            <T x={cx} y={b === 'schneider' ? 8.6 : 7.4} size={b === 'schneider' ? 3.9 : 3.4}>{`${product.curve ?? ''}${product.rating ?? ''}`}</T>
          )}
          {b === 'legrand' && <rect x={cx - 5.5} y={35} width={11} height={5.5} rx={0.6} fill="#eceee9" stroke="#c9ccc6" strokeWidth={0.2} />}
        </>
      );
      break;
    case 'rcd': {
      const tx = w * 0.29;
      body = (
        <>
          <Toggle brand={b} uid={uid} cx={tx} />
          <TestButton brand={b} cx={w * 0.72} cy={b === 'hager' ? 26 : 17} />
          <T x={w * 0.72} y={b === 'hager' ? 16 : 26} size={3}>{`${product.rating}A`}</T>
          <T x={w * 0.72} y={b === 'hager' ? 19.6 : 29.6} size={2.3} weight={600}>30mA</T>
          <rect x={w * 0.72 - 3.6} y={b === 'hager' ? 35 : 33} width={7.2} height={4.4} rx={0.6} fill="#fff" stroke="#26292d" strokeWidth={0.3} />
          <T x={w * 0.72} y={b === 'hager' ? 38.3 : 36.3} size={2.8}>{product.rcdType ?? ''}</T>
          {b === 'legrand' && <T x={tx} y={7.4} size={2.6}>ID</T>}
        </>
      );
      break;
    }
    case 'teleruptor':
      body = (
        <>
          <rect x={cx - 4} y={14} width={8} height={10} rx={1.4} fill="#2f3439" />
          <rect x={cx - 3.2} y={14.8} width={6.4} height={8.4} rx={1} fill={`url(#${uid}-knob)`} />
          <Led cx={cx} cy={29} color="#f59e0b" />
          <T x={cx} y={8} size={3}>TL</T>
          <T x={cx} y={39.5} size={2.3} weight={600}>{`${product.rating ?? 16}A`}</T>
        </>
      );
      break;
    case 'contactor-hc':
    case 'contactor':
      body = (
        <>
          <Selector cx={cx + 1} cy={20} />
          <Led cx={cx} cy={31} color="#22c55e" />
          <T x={cx} y={8} size={2.8}>{product.kind === 'contactor-hc' ? 'HC' : 'CT'}</T>
          <T x={cx} y={39.5} size={2.3} weight={600}>{`${product.rating ?? ''}A`}</T>
        </>
      );
      break;
    case 'spd':
      body = (
        <>
          <rect x={w * 0.3 - 3} y={14} width={6} height={9} rx={1} fill="#2f3439" />
          <rect x={w * 0.3 - 2.2} y={14.8} width={4.4} height={7.4} rx={0.6} fill="#22c55e" />
          <T x={w * 0.68} y={20} size={2.6}>SPD</T>
          <path d={`M${w * 0.68 - 3} 26H${w * 0.68 + 3}M${w * 0.68 - 2} 27.6H${w * 0.68 + 2}M${w * 0.68 - 1} 29.2H${w * 0.68 + 1}M${w * 0.68} 23V26`} stroke="#1f2937" strokeWidth={0.5} fill="none" />
          <T x={cx} y={39.5} size={2.3} weight={600}>Parafoudre</T>
        </>
      );
      break;
    case 'bell':
      body = (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={cx - 4.5 + (i % 4) * 3} cy={15 + Math.floor(i / 4) * 3} r={0.8} fill="#4b5563" />
          ))}
          <T x={cx} y={36} size={2.3} weight={600}>SON</T>
        </>
      );
      break;
    case 'bell-transformer':
      body = (
        <>
          <T x={cx} y={17} size={3.2}>8-12V</T>
          <path d={`M${cx - 4} 23q2 -2.4 4 0t4 0`} stroke="#1f2937" strokeWidth={0.6} fill="none" />
          <T x={cx} y={36} size={2.3} weight={600}>Transfo</T>
        </>
      );
      break;
    case 'timer':
      body = (
        <>
          <Knob uid={uid} cx={cx} cy={20} r={4.6} />
          <T x={cx} y={8} size={2.4}>MIN</T>
          <Led cx={cx} cy={32} color="#f59e0b" />
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <Lcd uid={uid} x={3} y={9} w={w - 6} h={11} text="12:00" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={4 + i * ((w - 8) / 4)} y={25} width={(w - 8) / 4 - 1.2} height={4.5} rx={1} fill="#4b5563" />
          ))}
          <T x={cx} y={38} size={2.3} weight={600}>Horloge</T>
        </>
      );
      break;
    case 'relay':
      body = (
        <>
          <rect x={cx - 2.5} y={15} width={5} height={9} rx={1} fill="#2f3439" />
          <rect x={cx - 1.8} y={15.6} width={3.6} height={4.2} rx={0.8} fill="#c7ccd1" />
          <Led cx={cx} cy={29} color="#ef4444" />
          <T x={cx} y={39.5} size={2.3} weight={600}>REL</T>
        </>
      );
      break;
    case 'load-shedder':
      body = (
        <>
          <Led cx={w * 0.3} cy={14} color="#22c55e" />
          <Led cx={w * 0.5} cy={14} color="#f59e0b" />
          <Led cx={w * 0.7} cy={14} color="#ef4444" />
          <Knob uid={uid} cx={cx} cy={25} r={4} />
          <T x={cx} y={39} size={2.3} weight={600}>Délesteur</T>
        </>
      );
      break;
    case 'heating-control':
      body = (
        <>
          <Led cx={w * 0.25} cy={13} color="#ef4444" />
          <Led cx={w * 0.42} cy={13} color="#f59e0b" />
          <Led cx={w * 0.58} cy={13} color="#22c55e" />
          <Led cx={w * 0.75} cy={13} color="#3b82f6" />
          <Selector cx={cx} cy={25} />
          <T x={cx} y={39} size={2.3} weight={600}>Fil pilote</T>
        </>
      );
      break;
    case 'energy-meter':
      body = (
        <>
          <Lcd uid={uid} x={1.6} y={10} w={w - 3.2} h={8} text="kWh" />
          <Led cx={cx} cy={24} color="#ef4444" />
          <T x={cx} y={36} size={2.2} weight={600}>kWh</T>
        </>
      );
      break;
    case 'socket':
      body = <SocketFace brand={b} uid={uid} w={w} />;
      break;
    case 'blank':
      body = (
        <>
          <rect x={1} y={4} width={w - 2} height={H - 8} rx={0.8} fill="#ffffff" opacity={0.45} />
          <path d={`M${1.5} ${H / 2}H${w - 1.5}`} stroke="#c3c7cb" strokeWidth={0.3} />
        </>
      );
      break;
    case 'reserve':
      return (
        <g>
          <rect x={0.4} y={0.4} width={w - 0.8} height={H - 0.8} rx={1} fill="#eef2f7" stroke="#64748b" strokeWidth={0.35} strokeDasharray="1.2 1" />
          <T x={cx} y={H / 2 + 1} size={Math.min(2.6, w / 5)} color="#64748b" weight={600}>
            Réserve
          </T>
        </g>
      );
  }
  return (
    <g>
      <Housing brand={b} uid={uid} w={w} />
      {body}
    </g>
  );
});
