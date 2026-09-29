import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast, useToastStore } from '../store/toastStore';
import {
  autoApplyWaitingUpdate,
  checkForUpdate,
  installUpdate,
  onUpdateActivated,
  reloadAfterChunkError,
  setRegistration,
  takeUpdateAnnouncement,
  useUpdateStore,
} from './updateStore';

/** Vérification périodique tant que l'application reste ouverte. */
const PERIODIC_CHECK_MS = 30 * 60_000;

/**
 * Enregistre le service worker : fonctionnement hors connexion + mises à jour.
 * Une nouvelle version prend la main dès qu'elle est téléchargée ; l'application se recharge
 * alors au retour au premier plan, ou tout de suite avec « Mettre à jour ».
 * Sur téléphone, l'application est le plus souvent reprise depuis l'arrière-plan : la recherche
 * est donc lancée au lancement, au retour au premier plan, à la reconnexion et toutes les 30 minutes.
 */
export function PwaUpdater() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg);
      if (!autoApplyWaitingUpdate(reg)) void checkForUpdate();
    },
    onNeedReload() {
      onUpdateActivated();
    },
    onRegisterError(error) {
      console.warn('Service worker non enregistré', error);
    },
  });

  useEffect(() => {
    const message = takeUpdateAnnouncement();
    if (message) useToastStore.getState().push({ kind: 'success', message }, 6000);
  }, []);

  useEffect(() => {
    if (offlineReady) {
      toast.success('Prêt à fonctionner hors connexion ✓');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    // Le service worker demande à chaque page si elle gère elle-même le rechargement (sinon il la recharge).
    const hadController = Boolean(navigator.serviceWorker?.controller);
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type !== 'MG_UPDATE_ACTIVATED') return;
      e.ports[0]?.postMessage('ok');
      if (hadController) onUpdateActivated();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const s = useUpdateStore.getState();
      if (s.needRefresh && !s.hardReset) void installUpdate();
      else void checkForUpdate();
    };
    const onOnline = () => void checkForUpdate();
    const onChunkError = (e: Event) => {
      if (reloadAfterChunkError()) e.preventDefault();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    }, PERIODIC_CHECK_MS);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    navigator.serviceWorker?.startMessages?.();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('vite:preloadError', onChunkError);
    return () => {
      window.clearInterval(timer);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('vite:preloadError', onChunkError);
    };
  }, []);

  return null;
}
