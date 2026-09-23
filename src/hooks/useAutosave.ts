import { useEffect, useRef } from 'react';
import type { PlanDocument } from '../types';
import { useEditorStore } from '../store/editorStore';
import { useSaveStatus } from '../store/saveStatusStore';
import { savePlanDocument, updatePlan } from '../database/planRepository';

const DEBOUNCE_MS = 400;

/**
 * Sauvegarde automatique (IndexedDB) après chaque modification importante,
 * avec un délai de 400 ms, jamais pendant un glisser en cours.
 */
export function useAutosave(enabled: boolean): void {
  const setStatus = useSaveStatus((s) => s.setStatus);
  const savedDoc = useRef<PlanDocument | null>(null);
  const savedMeta = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const st = useEditorStore.getState();
    savedDoc.current = st.doc;
    savedMeta.current = st.plan ? JSON.stringify([st.plan.layers, st.plan.backgroundOpacity]) : '';
    setStatus('saved');

    const flush = async () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const s = useEditorStore.getState();
      if (!s.plan || !s.projectId) return;
      if (saving.current) await saving.current;
      const doc = s.doc;
      const meta = JSON.stringify([s.plan.layers, s.plan.backgroundOpacity]);
      const docChanged = doc !== savedDoc.current;
      const metaChanged = meta !== savedMeta.current;
      if (!docChanged && !metaChanged) {
        setStatus('saved');
        return;
      }
      setStatus('saving');
      const planId = s.plan.id;
      const projectId = s.projectId;
      const prev = savedDoc.current ?? undefined;
      const layers = s.plan.layers;
      const backgroundOpacity = s.plan.backgroundOpacity;
      saving.current = (async () => {
        try {
          if (docChanged) await savePlanDocument(planId, projectId, doc, prev);
          if (metaChanged) await updatePlan(planId, { layers, backgroundOpacity });
          savedDoc.current = doc;
          savedMeta.current = meta;
          setStatus(useEditorStore.getState().doc === doc ? 'saved' : 'pending');
        } catch (e) {
          console.error(e);
          setStatus('error');
        } finally {
          saving.current = null;
        }
      })();
      await saving.current;
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (useEditorStore.getState().gestureStart) {
          schedule();
          return;
        }
        void flush();
      }, DEBOUNCE_MS);
    };

    const unsub = useEditorStore.subscribe((s, prev) => {
      if (s.doc !== prev.doc || s.plan?.layers !== prev.plan?.layers || s.plan?.backgroundOpacity !== prev.plan?.backgroundOpacity) {
        if (s.doc !== savedDoc.current || s.plan?.layers !== prev.plan?.layers || s.plan?.backgroundOpacity !== prev.plan?.backgroundOpacity) {
          setStatus('pending');
          schedule();
        }
      }
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [enabled, setStatus]);
}
