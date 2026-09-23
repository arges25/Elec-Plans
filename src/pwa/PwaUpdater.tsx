import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../store/toastStore';

/** Enregistre le service worker : fonctionnement hors connexion + mises à jour. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Service worker non enregistré', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('Prêt à fonctionner hors connexion ✓');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast.info('Nouvelle version de MG Elec & Plans disponible.', { label: 'Mettre à jour', onClick: () => void updateServiceWorker(true) }, 0);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
