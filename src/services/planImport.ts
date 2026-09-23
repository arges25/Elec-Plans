import type { PlanSource } from '../types';
import { updatePlan } from '../database/planRepository';
import { compressCanvas, compressImageFile } from './imageProcessing';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|pdf)$/i;

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isSupportedImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name) || (file.type.startsWith('image/') && file.type !== 'image/heic');
}

/** Enregistre une image importée comme fond du plan (compressée, ≈ 2400 px max). */
export async function saveImageToPlan(planId: string, file: File, source: PlanSource): Promise<{ width: number; height: number }> {
  const img = await compressImageFile(file);
  await updatePlan(planId, {
    originalImage: img.dataUrl,
    processedImage: undefined,
    width: img.width,
    height: img.height,
    source,
    backgroundOpacity: 1,
  });
  return img;
}

export async function saveCanvasToPlan(planId: string, canvas: HTMLCanvasElement, source: PlanSource): Promise<{ width: number; height: number }> {
  const img = compressCanvas(canvas);
  await updatePlan(planId, {
    originalImage: img.dataUrl,
    processedImage: undefined,
    width: img.width,
    height: img.height,
    source,
    backgroundOpacity: 1,
  });
  return img;
}
