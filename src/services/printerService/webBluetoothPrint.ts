import type { BluetoothPrinterProfile } from '../../types';
import { encodeRasterJob, rgbaToMono } from './escpos';

/**
 * Impression Bluetooth directe via Web Bluetooth (Chrome / Edge Android & ordinateur).
 * Non disponible sur iPhone / iPad (Safari) ni Firefox : dans ce cas, utiliser l'impression système ou le PDF.
 * Aucune connexion n'est simulée : toutes les fonctions échouent explicitement si le matériel ne répond pas.
 */

export const BLUETOOTH_UNAVAILABLE_MESSAGE = 'Impression Bluetooth directe non disponible sur ce navigateur. Utilisez l’impression système ou exportez le PDF.';

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && Boolean(navigator.bluetooth);
}

export async function isBluetoothAdapterAvailable(): Promise<boolean> {
  if (!isWebBluetoothAvailable()) return false;
  try {
    return await navigator.bluetooth.getAvailability();
  } catch {
    return false;
  }
}

export class BluetoothPrinterConnection {
  readonly device: BluetoothDevice;
  readonly profile: BluetoothPrinterProfile;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  constructor(device: BluetoothDevice, profile: BluetoothPrinterProfile) {
    this.device = device;
    this.profile = profile;
  }

  get connected(): boolean {
    return Boolean(this.device.gatt?.connected && this.characteristic);
  }

  async connect(): Promise<void> {
    if (!this.device.gatt) throw new Error('Appareil Bluetooth sans service GATT');
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(this.profile.serviceUuid);
    this.characteristic = await service.getCharacteristic(this.profile.characteristicUuid);
  }

  disconnect(): void {
    this.characteristic = null;
    if (this.device.gatt?.connected) this.device.gatt.disconnect();
  }

  /** Envoie des octets par paquets (taille limitée en BLE). */
  async write(data: Uint8Array): Promise<void> {
    const ch = this.characteristic;
    if (!ch || !this.device.gatt?.connected) throw new Error('Imprimante non connectée');
    const size = this.profile.chunkSize;
    for (let i = 0; i < data.length; i += size) {
      const chunk = data.slice(i, i + size);
      if (ch.properties.writeWithoutResponse && 'writeValueWithoutResponse' in ch) await ch.writeValueWithoutResponse(chunk);
      else await ch.writeValue(chunk);
    }
  }
}

let current: BluetoothPrinterConnection | null = null;

export function getCurrentBluetoothPrinter(): BluetoothPrinterConnection | null {
  return current && current.connected ? current : null;
}

/** Ouvre le sélecteur Bluetooth du navigateur puis se connecte à l'imprimante choisie. */
export async function requestAndConnectPrinter(profile: BluetoothPrinterProfile): Promise<BluetoothPrinterConnection> {
  if (!isWebBluetoothAvailable()) throw new Error(BLUETOOTH_UNAVAILABLE_MESSAGE);
  if (!profile.supported || !profile.serviceUuid) throw new Error('Profil d’imprimante non pris en charge');
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [profile.serviceUuid] });
  const conn = new BluetoothPrinterConnection(device, profile);
  await conn.connect();
  device.addEventListener('gattserverdisconnected', () => {
    if (current === conn) current = null;
  });
  current?.disconnect();
  current = conn;
  return conn;
}

export function disconnectBluetoothPrinter(): void {
  current?.disconnect();
  current = null;
}

/**
 * Imprime un canvas (déjà à la résolution de l'imprimante, largeur ≤ largeur imprimable)
 * en raster ESC/POS.
 */
export async function printCanvasEscPos(conn: BluetoothPrinterConnection, canvas: HTMLCanvasElement): Promise<void> {
  if (conn.profile.protocol !== 'escpos') throw new Error('Protocole non pris en charge par ce profil');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bmp = rgbaToMono(img.data, canvas.width, canvas.height);
  await conn.write(encodeRasterJob(bmp));
}

/** Largeur imprimable (points) d'un profil : papier - 10 mm de marges mécaniques. */
export function printableDots(profile: BluetoothPrinterProfile): number {
  const mm = Math.max(10, profile.paperWidthMm - 10);
  return Math.floor(((mm / 25.4) * profile.dpi) / 8) * 8;
}
