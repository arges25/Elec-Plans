import { memo } from 'react';
import type { DeviceProduct } from '../types';
import { DIN_MODULE_MM } from '../constants';
import { DEVICE_FACE_MM } from '../engine/geometry';
import { DeviceFace } from '../render/DeviceFace';

/** Vignette d'un appareil à l'échelle (utilise les définitions de <SharedDefs uid>). */
export const DeviceThumb = memo(function DeviceThumb({ product, uid, pxPerMm = 1.25 }: { product: DeviceProduct; uid: string; pxPerMm?: number }) {
  const w = product.modules * DIN_MODULE_MM;
  return (
    <svg width={w * pxPerMm} height={DEVICE_FACE_MM * pxPerMm} viewBox={`-0.5 -0.5 ${w + 1.5} ${DEVICE_FACE_MM + 2}`} aria-hidden className="shrink-0 drop-shadow-sm">
      <DeviceFace product={product} uid={uid} width={w} />
    </svg>
  );
});
