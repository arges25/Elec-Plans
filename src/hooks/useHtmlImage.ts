import { useEffect, useState } from 'react';

/** Charge une image (dataURL / URL) pour l'afficher dans Konva. */
export function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let cancelled = false;
    const el = new Image();
    el.onload = () => {
      if (!cancelled) setImg(el);
    };
    el.onerror = () => {
      if (!cancelled) setImg(null);
    };
    el.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return img;
}
