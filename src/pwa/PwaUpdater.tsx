import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../store/toastStore';
import {
  autoApplyWaitingUpdate,
  checkForUpdate,
  installUpdate,
  noteInteraction,
  onUpdateActivated,
  reloadAfterChunkError,
  setRegistration,
  takeUpdateAnnouncement,
  useUpdateStore,
} from './updateStore';

/** Vérification périodique tant que l'application reste ouverte. */
const PERIODIC_CHECK_MS = 30 * 60_000;

/**
 * Enregistre le service worker : fonctionnement hors connexion + mises à jour automatiques.
 * Une nouvelle version prend la main dès qu'elle est téléchargée ; l'application se recharge
 * toute seule au premier moment calme (aucune saisie ni tracé en cours, sauvegarde terminée),
 * puis affiche « Mise à jour effectuée ✓ ».
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
    if (takeUpdateAnnouncement()) useUpdateStore.setState({ justUpdated: true });
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
      const type = (e.data as { type?: string } | null)?.type;
      if (type !== 'MG_UPDATE_READY' && type !== 'MG_UPDATE_ACTIVATED') return;
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
    // Toucher / clavier : l'installation automatique attend une pause
    const interactions = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
    for (const ev of interactions) window.addEventListener(ev, noteInteraction, { capture: true, passive: true });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    }, PERIODIC_CHECK_MS);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    navigator.serviceWorker?.startMessages?.();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('vite:preloadError', onChunkError);
    return () => {
      for (const ev of interactions) window.removeEventListener(ev, noteInteraction, { capture: true });
      window.clearInterval(timer);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('vite:preloadError', onChunkError);
    };
  }, []);

  return null;
}
