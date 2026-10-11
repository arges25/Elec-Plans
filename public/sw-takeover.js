/*
 * MG Elec & Plans — prise en main d'une nouvelle version par le service worker.
 *
 * La nouvelle version s'active dès qu'elle est installée. Chaque page ouverte est
 * interrogée (« MG_UPDATE_READY ») : les versions récentes de l'application répondent et
 * se rechargent elles-mêmes au premier moment calme (après la fin de la sauvegarde).
 * Les anciennes versions ne répondent pas (celles qui attendaient un toucher sur
 * « Mettre à jour » écoutaient « MG_UPDATE_ACTIVATED ») : elles sont rechargées
 * automatiquement au bout de 3 secondes pour passer sur la nouvelle version.
 */
self.addEventListener('activate', () => {
  reloadOutdatedPages();
});

async function reloadOutdatedPages() {
  try {
    await self.clients.claim();
    const pages = await self.clients.matchAll({ type: 'window' });
    await Promise.all(
      pages.map(async (page) => {
        if (await handlesUpdate(page)) return;
        try {
          await page.navigate(page.url);
        } catch {
          // navigate() indisponible : la nouvelle version sera chargée à la prochaine ouverture.
        }
      }),
    );
  } catch {
    // Rien de bloquant : la nouvelle version reste active.
  }
}

function handlesUpdate(page) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 3000);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    page.postMessage({ type: 'MG_UPDATE_READY' }, [channel.port2]);
  });
}
