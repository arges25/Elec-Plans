import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogStore } from '../../store/dialogStore';
import { Button } from './Button';
import { TextField } from './Field';

/** Affiche les boîtes de confirmation / saisie demandées via confirmDialog() / promptDialog(). */
export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (current?.kind === 'prompt') {
      setValue(current.options.defaultValue ?? '');
      setError(null);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [current]);

  if (!current) return null;

  const cancel = () => {
    if (current.kind === 'confirm') current.resolve(false);
    else current.resolve(null);
    close();
  };

  const submit = () => {
    if (current.kind === 'confirm') {
      current.resolve(true);
      close();
      return;
    }
    const err = current.options.validate?.(value) ?? null;
    if (err) {
      setError(err);
      return;
    }
    current.resolve(value);
    close();
  };

  const o = current.options;
  const danger = current.kind === 'confirm' && current.options.danger;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-900/50 animate-fade-in" onClick={cancel} aria-hidden />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-pop-in mb-safe"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
        }}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="size-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="dlg-title" className="text-lg font-bold text-gray-900">
              {o.title}
            </h2>
            {o.message && <p className="mt-1 text-sm text-gray-600">{o.message}</p>}
          </div>
        </div>
        {current.kind === 'prompt' && (
          <div className="mt-4">
            <TextField
              ref={inputRef}
              label={current.options.label}
              value={value}
              placeholder={current.options.placeholder}
              inputMode={current.options.inputMode}
              onValueChange={(v) => {
                setValue(v);
                setError(null);
              }}
              error={error}
              autoFocus
            />
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={cancel}>{(current.kind === 'confirm' && current.options.cancelLabel) || 'Annuler'}</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} autoFocus={current.kind === 'confirm'}>
            {o.confirmLabel ?? (current.kind === 'confirm' ? 'Confirmer' : 'Valider')}
          </Button>
        </div>
      </form>
    </div>
  );
}
