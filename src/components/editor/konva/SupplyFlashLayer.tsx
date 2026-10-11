import { useEffect, useRef } from 'react';
import { Circle, Label, Layer, Line, Tag, Text } from 'react-konva';
import Konva from 'konva';
import type { PlacedSymbol } from '../../../types';
import { getSymbolDefinition } from '../../../data/electricalSymbols';
import { useEditorStore } from '../../../store/editorStore';
import { useSupplyFlashStore } from '../../../store/supplyFlashStore';
import { connectionGeometry } from '../../../utils/connections';
import { bezierToFlatPoints } from '../../../utils/geometry';
import { symbolWorldSize } from '../../../utils/symbols';

/** Durée d'un clignotement (ms) et nombre de clignotements. */
const FLASH_PERIOD_MS = 600;
const FLASH_COUNT = 4;
const ERROR_COLOR = '#dc2626';

/**
 * Calque « Flash de provenance » : le câble de l'élément jusqu'au tableau clignote
 * (4 flashs), puis reste illuminé tant que la carte « Alimentation » est ouverte.
 * Seule l'opacité du calque est animée : fluide sur mobile.
 */
export function SupplyFlashLayer({ zoom }: { zoom: number }) {
  const flash = useSupplyFlashStore((s) => s.flash);
  const symbols = useEditorStore((s) => s.doc.symbols);
  const connections = useEditorStore((s) => s.doc.connections);
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!flash || !layer) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      layer.opacity(1);
      layer.batchDraw();
      return;
    }
    const anim = new Konva.Animation((frame) => {
      const t = frame?.time ?? 0;
      if (t >= FLASH_PERIOD_MS * FLASH_COUNT) {
        layer.opacity(1);
        anim.stop();
        return;
      }
      // Flash net : plein éclat au début de chaque période, presque éteint au milieu
      layer.opacity(0.1 + 0.9 * Math.abs(Math.cos((Math.PI * t) / FLASH_PERIOD_MS)) ** 2);
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
    // Relance à chaque affichage (bouton « Rejouer » compris)
  }, [flash?.key]);

  if (!flash) return null;
  const px = (n: number) => n / zoom;
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const color = flash.status === 'none' ? ERROR_COLOR : flash.info.color;
  const glow = flash.status === 'none' ? 'rgba(220,38,38,0.28)' : flash.info.glow;
  const radius = (s: PlacedSymbol) => symbolWorldSize(getSymbolDefinition(s.symbolType), s.scale) * 0.7 + px(8);

  // Liaisons réelles du chemin (courbes identiques à celles du plan)
  const ids = new Set(flash.connectionIds);
  const curves = connections
    .filter((c) => ids.has(c.id))
    .map((c) => {
      const s = byId.get(c.sourceId);
      const t = byId.get(c.targetId);
      return s && t ? { id: c.id, points: bezierToFlatPoints(connectionGeometry(c, s, t)) } : null;
    })
    .filter((x): x is { id: string; points: number[] } => x !== null);

  // Tracé indicatif (du tableau vers l'élément, de proche en proche)
  const chain = flash.chainIds.map((id) => byId.get(id)).filter((s): s is PlacedSymbol => Boolean(s));
  const chainPoints = chain.flatMap((s) => [s.x, s.y]);

  const element = byId.get(flash.symbolId);
  const panel = flash.panelSymbolId ? byId.get(flash.panelSymbolId) : undefined;
  const members = flash.memberIds.map((id) => byId.get(id)).filter((s): s is PlacedSymbol => Boolean(s));
  const tagAnchor = panel ?? element;
  // Étiquette courte sur le plan (l'étiquette complète est dans la carte) : « Circuit 3 · 16 A »
  const tagText = flash.status === 'none' ? 'Aucun circuit' : (flash.planTag ?? flash.info.title);

  return (
    <Layer ref={layerRef} listening={false}>
      {members.map((m) => (
        <Circle key={`m-${m.id}`} x={m.x} y={m.y} radius={radius(m)} fill={glow} opacity={0.6} />
      ))}
      {curves.map((c) => (
        <Line key={`g-${c.id}`} points={c.points} bezier stroke={glow} strokeWidth={px(18)} lineCap="round" />
      ))}
      {curves.map((c) => (
        <Line key={`c-${c.id}`} points={c.points} bezier stroke={color} strokeWidth={px(5)} lineCap="round" />
      ))}
      {curves.map((c) => (
        <Line key={`w-${c.id}`} points={c.points} bezier stroke="#ffffff" strokeWidth={px(1.6)} dash={[px(6), px(10)]} lineCap="round" />
      ))}
      {chainPoints.length >= 4 && (
        <>
          <Line points={chainPoints} stroke={glow} strokeWidth={px(16)} lineCap="round" lineJoin="round" />
          <Line points={chainPoints} stroke={color} strokeWidth={px(4)} dash={[px(14), px(9)]} lineCap="round" lineJoin="round" />
        </>
      )}
      {panel && (
        <>
          <Circle x={panel.x} y={panel.y} radius={radius(panel) + px(6)} fill={glow} stroke={color} strokeWidth={px(4)} />
          <Circle x={panel.x} y={panel.y} radius={radius(panel) + px(14)} stroke={color} strokeWidth={px(1.5)} opacity={0.7} />
        </>
      )}
      {element && <Circle x={element.x} y={element.y} radius={radius(element)} fill={glow} stroke={color} strokeWidth={px(3.5)} />}
      {tagAnchor && (
        <Label x={tagAnchor.x} y={tagAnchor.y - radius(tagAnchor) - px(panel ? 18 : 10)}>
          <Tag fill={color} cornerRadius={px(6)} pointerDirection="down" pointerWidth={px(10)} pointerHeight={px(7)} />
          <Text text={tagText} fontSize={px(13)} fontStyle="bold" fontFamily="Helvetica, Arial, sans-serif" fill="#ffffff" padding={px(6)} />
        </Label>
      )}
    </Layer>
  );
}
