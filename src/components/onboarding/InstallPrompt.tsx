import { Download, Share, SquarePlus, X } from 'lucide-react';
import { isIos, isStandalone, triggerInstall, useInstallStore } from '../../pwa/installPrompt';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { LogoMark } from '../layout/Logo';

/**
 * Carte « Installer MG Elec & Plans ».
 * - Android / Chrome : bouton qui déclenche beforeinstallprompt.
 * - iPhone / iPad : explication (Partager → Sur l'écran d'accueil → Ajouter).
 * Masquée si l'application est déjà installée ou si l'utilisateur a choisi « Ne plus afficher ».
 */
export function InstallPrompt({ force = false, onClose }: { force?: boolean; onClose?: () => void }) {
  const deferred = useInstallStore((s) => s.deferred);
  const installed = useInstallStore((s) => s.installed);
  const dismissed = useSettingsStore((s) => s.settings.installHintDismissed);
  const update = useSettingsStore((s) => s.update);

  if (isStandalone() || installed) {
    return force ? <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">MG Elec &amp; Plans est installée sur cet appareil ✓</p> : null;
  }
  if (!force && dismissed) return null;
  const ios = isIos();
  if (!force && !ios && !deferred) return null;

  const dismiss = () => {
    update({ installHintDismissed: true });
    onClose?.();
  };

  return (
    <section className="relative rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm" aria-labelledby="install-title">
      {!force && (
        <button type="button" aria-label="Fermer" onClick={onClose ?? dismiss} className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
          <X className="size-5" aria-hidden />
        </button>
      )}
      <div className="flex items-center gap-3 pr-10">
        <LogoMark size={44} className="shrink-0 rounded-xl" />
        <div>
          <h2 id="install-title" className="font-bold text-gray-900">
            Installer MG Elec &amp; Plans
          </h2>
          <p className="text-sm text-gray-600">Accès direct depuis l’écran d’accueil, plein écran, hors connexion.</p>
        </div>
      </div>
      {deferred ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<Download className="size-5" aria-hidden />}
            onClick={async () => {
              const r = await triggerInstall();
              if (r === 'accepted') toast.success('Application installée ✓');
            }}
          >
            Installer
          </Button>
          {!force && (
            <Button variant="ghost" onClick={dismiss}>
              Ne plus afficher
            </Button>
          )}
        </div>
      ) : ios ? (
        <>
          <ol className="mt-3 space-y-2 text-sm text-gray-800">
            <li className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">1</span>
              Toucher <Share className="inline size-4 text-blue-600" aria-label="Partager" /> <strong>Partager</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">2</span>
              Choisir <SquarePlus className="inline size-4" aria-hidden /> <strong>« Sur l’écran d’accueil »</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">3</span>
              Toucher <strong>Ajouter</strong>
            </li>
          </ol>
          {!force && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={dismiss}>
              Ne plus afficher
            </Button>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».
        </p>
      )}
    </section>
  );
}
