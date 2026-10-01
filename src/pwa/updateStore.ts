import { create } from 'zustand';
import { useSaveStatus } from '../store/saveStatusStore';

export type UpdateCheckResult = 'available' | 'downloading' | 'up-to-date' | 'offline' | 'unavailable';

interface UpdateState {
  /** La nouvelle version est prête : il reste à recharger l'application. */
  needRefresh: boolean;
  /**
   * La version en ligne est différente mais le service worker ne l'a pas récupérée :
   * « Mettre à jour » repart de zéro (copie hors connexion effacée, projets conservés).
   */
  hardReset: boolean;
  /** L'utilisateur a choisi « Plus tard » : le bandeau est masqué jusqu'au prochain lancement. */
  dismissed: boolean;
  checking: boolean;
  applying: boolean;
  /** Mise à jour appliquée au lancement : bandeau vert « Application mise à jour ✓ » jusqu'à « OK ». */
  justUpdated: boolean;
}

export const useUpdateStore = create<UpdateState>(() => ({
  needRefresh: false,
  hardReset: false,
  dismissed: false,
  checking: false,
  applying: false,
  justUpdated: false,
}));

const CURRENT_BUILD = `${__APP_BUILD__.commit}|${__APP_BUILD__.date}`;
/** Vérification automatique au plus une fois par minute (retour au premier plan, reconnexion, minuterie). */
const AUTO_CHECK_INTERVAL_MS = 60_000;
/** Délai avant de proposer de repartir de zéro si le service worker ne récupère pas la version en ligne. */
const STALE_BEFORE_RESET_MS = 15 * 60_000;
/** Cache conservé lors d'une remise à zéro (OpenCV.js, ≈ 13 Mo, téléchargé à la première utilisation). */
const KEPT_CACHES = ['mg-opencv'];

let registration: ServiceWorkerRegistration | undefined;
let lastCheck = 0;
let staleSince = 0;

export function setRegistration(reg: ServiceWorkerRegistration | undefined): void {
  registration = reg;
}

/** Nouvelle version activée par le service worker : rechargement immédiat si l'application est en arrière-plan, sinon bandeau. */
export function onUpdateActivated(): void {
  useUpdateStore.setState({ needRefresh: true, hardReset: false, dismissed: false });
  if (document.visibilityState === 'hidden') void installUpdate();
}

/** Version publiée en ligne (version.json, jamais mis en cache), ou null si indisponible. */
async function onlineBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const v = (await res.json()) as { commit?: string; date?: string };
    return v.commit && v.date ? `${v.commit}|${v.date}` : null;
  } catch {
    return null;
  }
}

/** Demande au navigateur de télécharger la dernière version publiée, puis la compare à la version en ligne. */
export async function checkForUpdate(manual = false): Promise<UpdateCheckResult> {
  if (useUpdateStore.getState().needRefresh) return 'available';
  if (!registration) return 'unavailable';
  if (!manual && Date.now() - lastCheck < AUTO_CHECK_INTERVAL_MS) return 'up-to-date';
  if (!navigator.onLine) return 'offline';
  lastCheck = Date.now();
  useUpdateStore.setState({ checking: true });
  try {
    try {
      await registration.update();
    } catch {
      // Vérifié ci-dessous avec version.json.
    }
    if (useUpdateStore.getState().needRefresh) return 'available';
    const online = await onlineBuild();
    if (online === null) return navigator.onLine ? 'up-to-date' : 'offline';
    if (online === CURRENT_BUILD) {
      staleSince = 0;
      return 'up-to-date';
    }
    if (registration.installing || registration.waiting) return 'downloading';
    if (!staleSince) staleSince = Date.now();
    if (manual || Date.now() - staleSince >= STALE_BEFORE_RESET_MS) {
      useUpdateStore.setState({ needRefresh: true, hardReset: true, dismissed: false });
      return 'available';
    }
    return 'downloading';
  } finally {
    useUpdateStore.setState({ checking: false });
  }
}

/** Attend la fin de la sauvegarde automatique en cours (4 s au plus). */
async function waitForSave(): Promise<void> {
  const deadline = Date.now() + 4000;
  while (['pending', 'saving'].includes(useSaveStatus.getState().status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Ancien service worker « en attente » (versions précédentes) : lui demander de prendre la main. */
async function activateWaiting(worker: ServiceWorker): Promise<void> {
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(resolve, 3000);
  });
}

/** Repart de zéro : service worker et copie hors connexion supprimés. Les projets (IndexedDB) et les réglages ne sont pas touchés. */
async function resetOfflineCopy(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEPT_CACHES.includes(k)).map((k) => caches.delete(k)));
    }
  } catch {
    // Le rechargement ci-après récupère de toute façon la version en ligne si possible.
  }
}

/** Applique la mise à jour après la fin de la sauvegarde en cours, puis recharge l'application. */
export async function installUpdate(): Promise<void> {
  if (useUpdateStore.getState().applying) return;
  useUpdateStore.setState({ applying: true });
  await waitForSave();
  if (useUpdateStore.getState().hardReset) await resetOfflineCopy();
  else if (registration?.waiting) await activateWaiting(registration.waiting);
  window.location.reload();
}

const AUTO_APPLY_KEY = 'mg-update-auto-applied-at';
const LAST_BUILD_KEY = 'mg-last-build';

/**
 * Au lancement : si une nouvelle version attend (service worker d'une version précédente),
 * elle est installée tout de suite. Une seule tentative par minute, pour ne jamais recharger en boucle.
 */
export function autoApplyWaitingUpdate(reg: ServiceWorkerRegistration | undefined): boolean {
  if (!reg?.waiting || !navigator.serviceWorker?.controller || !onceAMinute(AUTO_APPLY_KEY)) return false;
  void installUpdate();
  return true;
}

/** Module introuvable (fichier d'une version précédente supprimé du serveur) : rechargement, une fois par minute au plus. */
export function reloadAfterChunkError(): boolean {
  if (!onceAMinute('mg-chunk-reload-at')) return false;
  void waitForSave().then(() => window.location.reload());
  return true;
}

function onceAMinute(key: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Après une mise à jour (version différente de la dernière ouverte) : true, une seule fois. */
export function takeUpdateAnnouncement(): boolean {
  try {
    const previous = localStorage.getItem(LAST_BUILD_KEY);
    localStorage.setItem(LAST_BUILD_KEY, CURRENT_BUILD);
    // Sans version mémorisée : première ouverture après installation (page pas encore gérée par le
    // service worker), ou mise à jour depuis une version antérieure à ce mécanisme (page déjà gérée).
    const updated = previous ? previous !== CURRENT_BUILD : Boolean(navigator.serviceWorker?.controller);
    return updated;
  } catch {
    return false;
  }
}

function buildDate(): string {
  return new Date(__APP_BUILD__.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** « Version 1.0.0 du 29/09/2026 à 23:33 (f3871be) » */
export function buildLabel(): string {
  const time = new Date(__APP_BUILD__.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Version ${__APP_VERSION__} du ${buildDate()} à ${time} (${__APP_BUILD__.commit})`;
}
