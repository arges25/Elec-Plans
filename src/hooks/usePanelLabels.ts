import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { listTemplates } from '../database/templateRepository';
import { listPrinterProfiles } from '../database/printerRepository';
import { buildLabelStrips } from '../utils/labelLayout';
import { useSettingsStore } from '../store/settingsStore';

/** Données d'un tableau prêtes pour l'étiquetage. */
export function usePanelLabels(panelId: string | undefined) {
  const panel = useLiveQuery(() => (panelId ? db.panels.get(panelId) : undefined), [panelId]);
  const circuits = useLiveQuery(() => (panelId ? db.circuits.where('panelId').equals(panelId).sortBy('order') : []), [panelId]);
  const labels = useLiveQuery(() => (panelId ? db.labels.where('panelId').equals(panelId).toArray() : []), [panelId]);
  const templates = useLiveQuery(() => listTemplates(), []);
  const printers = useLiveQuery(() => listPrinterProfiles(), []);
  const project = useLiveQuery(() => (panel?.projectId ? db.projects.get(panel.projectId) : undefined), [panel?.projectId]);
  const defaultPrinterId = useSettingsStore((s) => s.settings.defaultPrinterProfileId);
  const template = templates?.find((t) => t.id === panel?.templateId) ?? templates?.[0];
  const strips = useMemo(
    () => (panel && circuits && labels && template ? buildLabelStrips(panel.rows, circuits, labels, template) : []),
    [panel, circuits, labels, template],
  );
  const printer = printers?.find((p) => p.id === defaultPrinterId) ?? printers?.[0];
  return { panel, circuits: circuits ?? [], labels: labels ?? [], templates: templates ?? [], template, strips, printers: printers ?? [], printer, project };
}
