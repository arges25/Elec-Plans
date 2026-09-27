import { describe, expect, it } from 'vitest';
import { ELECTRICAL_SYMBOLS, QUICK_GROUPS, getSymbolDefinition, searchSymbols } from '../data/electricalSymbols';
import { WALL_BACK } from '../data/symbolShapes';

describe('Nouveaux symboles et prises redessinées', () => {
  it('détecteurs de mouvement / présence et écran domotique disponibles', () => {
    const motion = getSymbolDefinition('detecteur-mouvement');
    const presence = getSymbolDefinition('detecteur-presence');
    const screen = getSymbolDefinition('ecran-domotique');
    expect(motion.name).toBe('Détecteur de mouvement');
    expect(motion.snapToWall).toBe(true);
    expect(presence.name).toBe('Détecteur de présence');
    expect(presence.snapToWall).toBe(false);
    expect(screen.name).toBe('Écran domotique');
    // Ce sont des commandes : elles peuvent être reliées à l'éclairage
    for (const d of [motion, presence, screen]) expect(d.role).toBe('switch');
    expect(searchSymbols('detecteur presence')[0].id).toBe('detecteur-presence');
    expect(searchSymbols('écran domotique')[0].id).toBe('ecran-domotique');
    expect(searchSymbols('mouvement').map((s) => s.id)).toContain('detecteur-mouvement');
  });

  it('prises 2P+T, double, commandée, étanche, RJ45, TV : accès rapide et dos au mur', () => {
    const ids = ['prise-16a', 'prise-double-16a', 'prise-commandee', 'prise-etanche', 'prise-rj45', 'prise-tv'];
    const quick: readonly string[] = QUICK_GROUPS.prises;
    for (const id of ids) {
      const d = getSymbolDefinition(id);
      expect(d.id).toBe(id);
      expect(d.snapToWall).toBe(true);
      expect(quick).toContain(id);
      // Le symbole touche la face du mur (raccordement au mur)
      expect(d.svg).toContain(`${WALL_BACK}`);
    }
    expect(getSymbolDefinition('prise-16a').name).toBe('Prise 2P+T 16A');
    expect(searchSymbols('prise commandée')[0].id).toBe('prise-commandee');
    expect(searchSymbols('2p+t').map((s) => s.id)).toContain('prise-16a');
  });

  it('tous les raccourcis pointent vers des symboles existants', () => {
    const ids = new Set(ELECTRICAL_SYMBOLS.map((s) => s.id));
    for (const list of Object.values(QUICK_GROUPS)) for (const id of list) expect(ids.has(id)).toBe(true);
    for (const id of ['detecteur-mouvement', 'detecteur-presence', 'ecran-domotique']) expect(QUICK_GROUPS.commandes as readonly string[]).toContain(id);
  });
});
