/** Génère un identifiant unique (UUID v4 si disponible). */
export function createId(prefix = ''): string {
  const c = globalThis.crypto as Crypto | undefined;
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${raw}` : raw;
}
