import Dexie, { type EntityTable } from 'dexie';
import type {
  AppSettings,
  ElectricalCircuit,
  ElectricalConnection,
  ElectricalPanel,
  Label,
  PanelTemplate,
  PlacedSymbol,
  Plan,
  PrinterProfile,
  Project,
} from '../types';

/**
 * Base locale IndexedDB (via Dexie). Aucune donnée n'est envoyée sur internet :
 * tout reste sur l'appareil.
 */
export class MgDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  symbolsPlaced!: EntityTable<PlacedSymbol, 'id'>;
  connections!: EntityTable<ElectricalConnection, 'id'>;
  circuits!: EntityTable<ElectricalCircuit, 'id'>;
  panels!: EntityTable<ElectricalPanel, 'id'>;
  labels!: EntityTable<Label, 'id'>;
  printerProfiles!: EntityTable<PrinterProfile, 'id'>;
  customTemplates!: EntityTable<PanelTemplate, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor(name = 'mg-elec-plans') {
    super(name);
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      plans: 'id, projectId, order',
      symbolsPlaced: 'id, projectId, planId',
      connections: 'id, projectId, planId, sourceId, targetId',
      circuits: 'id, panelId, rowId',
      panels: 'id, projectId, updatedAt',
      labels: 'id, panelId, circuitId',
      printerProfiles: 'id, name',
      customTemplates: 'id, name',
      settings: 'id',
    });
  }
}

export const db = new MgDatabase();
