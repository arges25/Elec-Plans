import type { BluetoothPrinterProfile } from '../types';

/**
 * Profils d'imprimantes Bluetooth (Web Bluetooth / BLE).
 *
 * Il n'existe PAS de protocole universel : chaque imprimante a son propre service GATT
 * et son propre langage. Seuls les profils marqués `supported` envoient réellement des données.
 * Les autres servent de base pour ajouter un pilote ultérieurement.
 */
export const BLUETOOTH_PRINTER_PROFILES: BluetoothPrinterProfile[] = [
  {
    id: 'escpos-ble-generic',
    name: 'ESC/POS BLE générique (expérimental)',
    // Service/caractéristique très répandus sur les petites imprimantes thermiques BLE.
    serviceUuid: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUuid: '00002af1-0000-1000-8000-00805f9b34fb',
    protocol: 'escpos',
    paperWidthMm: 58,
    dpi: 203,
    chunkSize: 180,
    experimental: true,
    supported: true,
    description:
      "Imprimantes thermiques compatibles ESC/POS exposant le service BLE 0x18F0. Impression raster (GS v 0). Largeur d'impression limitée au papier (58 mm) : l'étiquette est imprimée en plusieurs segments si nécessaire.",
  },
  {
    id: 'thermal-raw-placeholder',
    name: 'Imprimante thermique (profil à compléter)',
    serviceUuid: '',
    characteristicUuid: '',
    protocol: 'thermal-raw',
    paperWidthMm: 12,
    dpi: 180,
    chunkSize: 100,
    experimental: true,
    supported: false,
    description: 'Emplacement réservé pour une imprimante d’étiquettes thermique. Protocole non implémenté : utilisez le PDF ou l’impression système.',
  },
  {
    id: 'proprietary-placeholder',
    name: 'Imprimante propriétaire (non prise en charge)',
    serviceUuid: '',
    characteristicUuid: '',
    protocol: 'proprietary',
    paperWidthMm: 12,
    dpi: 180,
    chunkSize: 100,
    experimental: true,
    supported: false,
    description: 'Les imprimantes à protocole propriétaire nécessitent un pilote spécifique non disponible dans cette version.',
  },
];

export function getBluetoothProfile(id: string): BluetoothPrinterProfile | undefined {
  return BLUETOOTH_PRINTER_PROFILES.find((p) => p.id === id);
}
