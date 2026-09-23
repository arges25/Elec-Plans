import { describe, expect, it } from 'vitest';
import { buildDemoBundle } from '../data/demoProject';
import { parseProjectBundle, remapBundleIds, serializeBundle } from '../services/projectTransfer';

describe('Sérialisation projet (.mgeplan)', () => {
  it('aller-retour JSON sans perte', () => {
    const bundle = buildDemoBundle();
    const parsed = parseProjectBundle(serializeBundle(bundle));
    expect(parsed.project.name).toBe('Maison Démo');
    expect(parsed.symbols).toHaveLength(bundle.symbols.length);
    expect(parsed.connections).toHaveLength(bundle.connections.length);
    expect(parsed.plans[0].vectorData.walls).toHaveLength(bundle.plans[0].vectorData.walls.length);
    expect(parsed.circuits).toHaveLength(bundle.circuits.length);
  });

  it('import en copie : nouveaux identifiants, relations conservées', () => {
    const bundle = buildDemoBundle();
    const copy = remapBundleIds(bundle, 'Copie');
    expect(copy.project.id).not.toBe(bundle.project.id);
    expect(copy.project.name).toBe('Copie');
    const planIds = new Set(copy.plans.map((p) => p.id));
    const symIds = new Set(copy.symbols.map((s) => s.id));
    const circuitIds = new Set(copy.circuits.map((c) => c.id));
    const rowIds = new Set(copy.panels.flatMap((p) => p.rows.map((r) => r.id)));
    expect(copy.project.floors.every((f) => planIds.has(f.planId))).toBe(true);
    expect(copy.symbols.every((s) => planIds.has(s.planId) && s.projectId === copy.project.id)).toBe(true);
    expect(copy.connections.every((c) => symIds.has(c.sourceId) && symIds.has(c.targetId))).toBe(true);
    expect(copy.symbols.filter((s) => s.properties.circuitId).every((s) => circuitIds.has(s.properties.circuitId!))).toBe(true);
    expect(copy.circuits.every((c) => rowIds.has(c.rowId))).toBe(true);
    expect([...symIds].some((id) => bundle.symbols.some((s) => s.id === id))).toBe(false);
  });

  it('refuse un fichier qui n’est pas un projet', () => {
    expect(() => parseProjectBundle('{"hello":1}')).toThrow(/Format non pris en charge/);
    expect(() => parseProjectBundle('pas du json')).toThrow();
  });
});
