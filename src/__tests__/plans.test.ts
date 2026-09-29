import { describe, expect, it } from 'vitest';
import { floorTypeFromName, planNameError, suggestPlanNames } from '../utils/planFactory';

describe('Plans d’un chantier', () => {
  it('type de niveau déduit du nom saisi', () => {
    expect(floorTypeFromName('RDC')).toBe('rdc');
    expect(floorTypeFromName('rez-de-chaussée')).toBe('rdc');
    expect(floorTypeFromName('étage 1')).toBe('etage1');
    expect(floorTypeFromName('Étage 2')).toBe('etage2');
    expect(floorTypeFromName('Garage')).toBe('garage');
    expect(floorTypeFromName('Sous-sol')).toBe('sous-sol');
    expect(floorTypeFromName('Extension cuisine')).toBe('custom');
  });

  it('noms proposés sans ceux déjà utilisés', () => {
    const s = suggestPlanNames(['RDC', 'étage 1']);
    expect(s[0]).toBe('Étage 2');
    expect(s).not.toContain('RDC');
    expect(s).not.toContain('Étage 1');
    expect(s).toContain('Garage');
  });

  it('nom obligatoire et unique sur le chantier (accents et casse ignorés)', () => {
    expect(planNameError('  ', ['RDC'])).toBe('Donnez un nom au plan');
    expect(planNameError('etage 1', ['Étage 1'])).toBe('Un plan porte déjà ce nom sur ce chantier');
    expect(planNameError('Garage', ['RDC', 'Étage 1'])).toBeNull();
    expect(planNameError('x'.repeat(41), [])).toContain('trop long');
  });
});
