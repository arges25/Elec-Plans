import { create } from 'zustand';
import { useSaveStatus } from '../store/saveStatusStore';
import { useDialogStore } from '../store/dialogStore';

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
  /**
   * L'installation automatique attend une pause depuis un moment (saisie, tracé en cours…) :
   * le bandeau « Installer maintenant » est alors proposé.
   */
  deferred: boolean;
  checking: boolean;
  applying: boolean;
  /** Mise à jour appliquée au lancement : bandeau vert « Mise à jour effectuée ✓ » jusqu'à « OK ». */
  justUpdated: boolean;
}

export const useUpdateStore = create<UpdateState>(() => ({
  needRefresh: false,
  hardReset: false,
  dismissed: false,
  deferred: false,
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

/** Nouvelle version activée par le service worker : elle est installée automatiquement dès que possible. */
export function onUpdateActivated(): void {
  useUpdateStore.setState({ needRefresh: true, hardReset: false, dismissed: false });
  scheduleAutoInstall();
}

/* ------------------------------------------------------------------ */
/* Installation automatique                                            */
/* ------------------------------------------------------------------ */

/** Pause minimale sans toucher l'écran ni le clavier avant de recharger (ms). */
const IDLE_BEFORE_INSTALL_MS = 3000;
/** Au-delà, le bandeau « Installer maintenant » est proposé (ms). */
const DEFER_NOTICE_MS = 20_000;
let lastInteraction = 0;
/** Pages qui signalent une action en cours (ex. éditeur : geste ou tracé non terminé). */
const busyChecks = new Set<() => boolean>();

/** Une page déclare quand un rechargement ferait perdre une action en cours ; renvoie la fonction de retrait. */
export function registerBusyCheck(check: () => boolean): () => void {
  busyChecks.add(check);
  return () => {
    busyChecks.delete(check);
  };
}
let autoTimer: number | null = null;

/** Appelé à chaque toucher / frappe : l'installation attend une pause. */
export function noteInteraction(): void {
  lastInteraction = Date.now();
}

/**
 * Peut-on recharger sans gêner ? Aucune saisie au clavier, aucune fenêtre de dialogue,
 * aucun geste ni tracé en cours dans l'éditeur, sauvegarde terminée, et 3 s sans toucher l'écran.
 */
export function isSafeToReload(now = Date.now()): boolean {
  if (now - lastInteraction < IDLE_BEFORE_INSTALL_MS) return false;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return false;
  if (useDialogStore.getState().current) return false;
  for (const busy of busyChecks) if (busy()) return false;
  return !['pending', 'saving'].includes(useSaveStatus.getState().status);
}

/** Installe la nouvelle version au premier moment calme (immédiatement si l'application est en arrière-plan). */
function scheduleAutoInstall(): void {
  if (autoTimer !== null) return;
  const since = Date.now();
  const tick = () => {
    const s = useUpdateStore.getState();
    if (!s.needRefresh || s.applying) return stopAutoInstall();
    if (document.visibilityState === 'hidden' || isSafeToReload()) {
      stopAutoInstall();
      // Garde-fou : jamais plus d'un rechargement automatique toutes les 2 minutes
      if (onceEvery(AUTO_INSTALL_KEY, 120_000)) void installUpdate();
      else useUpdateStore.setState({ deferred: true });
      return;
    }
    if (!s.deferred && Date.now() - since > DEFER_NOTICE_MS) useUpdateStore.setState({ deferred: true });
  };
  autoTimer = window.setInterval(tick, 1000);
  tick();
}

function stopAutoInstall(): void {
  if (autoTimer !== null) window.clearInterval(autoTimer);
  autoTimer = null;
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
      scheduleAutoInstall();
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
const AUTO_INSTALL_KEY = 'mg-update-auto-installed-at';
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
  return onceEvery(key, 60_000);
}

/** Vrai au plus une fois par période (mémorisé pour la session, survit au rechargement). */
function onceEvery(key: string, periodMs: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < periodMs) return false;
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
