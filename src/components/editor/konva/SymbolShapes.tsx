import { memo } from 'react';
import { Circle, Path, Text } from 'react-konva';
import type { PrimitiveFill, SymbolPrimitive } from '../../../types';

function fillOf(fill: PrimitiveFill | undefined, color: string): string | undefined {
  if (fill === 'color') return color;
  if (fill === 'white') return '#ffffff';
  return undefined;
}

/** Dessine les primitives d'un symbole (boîte 40 × 40) avec Konva. */
export const SymbolShapes = memo(function SymbolShapes({ shapes, color }: { shapes: SymbolPrimitive[]; color: string }) {
  return (
    <>
      {shapes.map((s, i) => {
        if (s.k === 'path')
          return (
            <Path
              key={i}
              data={s.d}
              stroke={s.stroke === false ? undefined : color}
              strokeWidth={s.sw ?? 2.2}
              fill={fillOf(s.fill, color)}
              lineCap="round"
              lineJoin="round"
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        if (s.k === 'circle')
          return (
            <Circle
              key={i}
              x={s.cx}
              y={s.cy}
              radius={s.r}
              stroke={s.stroke === false ? undefined : color}
              strokeWidth={s.sw ?? 2.2}
              fill={fillOf(s.fill, color)}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        return (
          <Text
            key={i}
            x={s.x - 20}
            y={s.y - s.size / 2}
            width={40}
            height={s.size}
            align="center"
            verticalAlign="middle"
            text={s.text}
            fontSize={s.size}
            fontStyle={s.bold === false ? 'normal' : 'bold'}
            fontFamily="Helvetica, Arial, sans-serif"
            fill={s.fill === 'white' ? '#ffffff' : color}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      })}
    </>
  );
});
