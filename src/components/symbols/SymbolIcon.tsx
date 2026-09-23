import { memo } from 'react';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { primitivesToSvgInner } from '../../data/symbolShapes';

/** Vignette SVG d'un symbole de la bibliothèque. */
export const SymbolIcon = memo(function SymbolIcon({ id, size = 40, color, className = '' }: { id: string; size?: number; color?: string; className?: string }) {
  const def = getSymbolDefinition(id);
  const inner = primitivesToSvgInner(def.shapes, color ?? def.color);
  return (
    <svg
      width={size}
      height={size}
      viewBox="-21 -21 42 42"
      className={className}
      aria-hidden
      style={{ overflow: 'visible' }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
});
