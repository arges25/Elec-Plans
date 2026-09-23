/**
 * Impression d'un PDF généré localement.
 * - Ordinateur / Android : iframe cachée + boîte d'impression du système ;
 * - iPhone / iPad : ouverture du PDF (Partager → Imprimer / AirPrint).
 */
export async function printPdfBlob(blob: Blob): Promise<'dialog' | 'opened'> {
  const url = URL.createObjectURL(blob);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'opened';
  }
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    iframe.src = url;
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve('dialog');
        } catch {
          window.open(url, '_blank');
          resolve('opened');
        }
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }, 300);
    };
    document.body.appendChild(iframe);
  });
}

export function pdfBytesToBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}
