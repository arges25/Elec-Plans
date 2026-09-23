import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

/** Évite l'écran blanc : affiche une erreur lisible avec un bouton pour recharger. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erreur MG Elec & Plans', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center" role="alert">
        <AlertTriangle className="size-12 text-brand-500" aria-hidden />
        <h1 className="text-xl font-bold text-gray-900">Une erreur est survenue</h1>
        <p className="max-w-md text-sm text-gray-600">
          Vos projets enregistrés ne sont pas perdus (ils sont stockés sur cet appareil). Rechargez l’application pour continuer.
        </p>
        <p className="max-w-md break-words rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-500">
          {this.state.error.name}: {this.state.error.message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 font-semibold text-white"
          >
            <RefreshCw className="size-5" aria-hidden /> Recharger
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 font-semibold"
          >
            <Home className="size-5" aria-hidden /> Accueil
          </button>
        </div>
      </div>
    );
  }
}
