/** Pictogramme « bande LED tracée » : tube coloré avec points lumineux et angles. */
export function LedStripIcon({ size = 20, color = '#eab308', className = '' }: { size?: number; color?: string; className?: string }) {
  const d = 'M4 19V6H20V14';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path d={d} stroke="#1f2937" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.01 3.6" />
    </svg>
  );
}
