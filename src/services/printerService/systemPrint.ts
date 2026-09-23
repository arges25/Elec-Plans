/**
 * Impression système (AirPrint / Wi-Fi / imprimante par défaut) d'un document HTML
 * dimensionné en millimètres. L'utilisateur doit désactiver « Ajuster à la page ».
 */
export function printHtmlDocument(bodyHtml: string, options: { pageWidthMm: number; pageHeightMm: number; title: string }): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error('Impression indisponible');
  }
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${options.title}</title>
<style>
@page { size: ${options.pageWidthMm}mm ${options.pageHeightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; }
body { width: ${options.pageWidthMm}mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Helvetica, Arial, sans-serif; }
.page { position: relative; width: ${options.pageWidthMm}mm; height: ${options.pageHeightMm}mm; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
svg { position: absolute; display: block; }
</style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 60_000);
    }
  };
  if (doc.readyState === 'complete') setTimeout(run, 250);
  else iframe.onload = () => setTimeout(run, 250);
}
