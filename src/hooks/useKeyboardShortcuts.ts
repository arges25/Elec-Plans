import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useViewStore } from '../store/viewStore';

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

/** Raccourcis ordinateur : Ctrl+C / Ctrl+V / Ctrl+Z / Ctrl+Y / Suppr / Échap / Ctrl+D / R. */
export function useKeyboardShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || document.querySelector('[role="alertdialog"]')) return;
      const st = useEditorStore.getState();
      if (st.clientPreview) {
        if (e.key === 'Escape') st.setClientPreview(false);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        st.redo();
      } else if (mod && key === 'c') {
        st.copySelection();
      } else if (mod && key === 'v') {
        e.preventDefault();
        st.paste();
      } else if (mod && key === 'd') {
        e.preventDefault();
        st.duplicateSelection(20);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection) {
          e.preventDefault();
          st.deleteSelection();
        }
      } else if (e.key === 'Escape') {
        if (st.clientPreview) st.setClientPreview(false);
        else if (st.tool !== 'select') st.setTool('select');
        else st.clearSelection();
      } else if (!mod && key === 'r' && st.selection?.kind === 'symbol') {
        st.rotateSelection(e.shiftKey ? -90 : 90);
      } else if (!mod && (e.key === '+' || e.key === '=')) {
        useViewStore.getState().api?.zoomBy(1.2);
      } else if (!mod && e.key === '-') {
        useViewStore.getState().api?.zoomBy(1 / 1.2);
      } else if (!mod && key === '0') {
        useViewStore.getState().api?.fit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
