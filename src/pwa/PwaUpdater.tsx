import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../store/toastStore';
import { checkForUpdate, setRegistration, setUpdater, useUpdateStore } from './updateStore';

/** Vérification périodique tant que l'application reste ouverte. */
const PERIODIC_CHECK_MS = 30 * 60_000;

/**
 * Enregistre le service worker : fonctionnement hors connexion + mises à jour.
 * Sur téléphone, l'application est le plus souvent reprise depuis l'arrière-plan
 * (sans nouveau chargement) : la recherche de mise à jour est donc aussi lancée
 * au retour au premier plan, à la reconnexion et toutes les 30 minutes.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg);
    },
    onRegisterError(error) {
      console.warn('Service worker non enregistré', error);
    },
  });

  useEffect(() => setUpdater(updateServiceWorker), [updateServiceWorker]);

  useEffect(() => {
    if (offlineReady) {
      toast.success('Prêt à fonctionner hors connexion ✓');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    useUpdateStore.setState({ needRefresh });
  }, [needRefresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    const onOnline = () => void checkForUpdate();
    const timer = window.setInterval(onVisible, PERIODIC_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
