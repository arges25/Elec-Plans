/** Dégradés, motifs et filtres partagés par le coffret et les faces d'appareils. */
export function BoardDefs({ uid }: { uid: string }) {
  const lin = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1) => (
    <linearGradient id={`${uid}-${id}`} x1="0" y1="0" x2={x2} y2={y2}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  );
  return (
    <defs>
      {lin('face-legrand', [[0, '#ffffff'], [1, '#e9e8e3']])}
      {lin('face-schneider', [[0, '#fbfcfd'], [1, '#dbe2e8']])}
      {lin('face-hager', [[0, '#fefdfa'], [1, '#e4e1da']])}
      {lin('tog-legrand', [[0, '#575d64'], [1, '#1b1e22']])}
      {lin('tog-schneider', [[0, '#f4f6f8'], [1, '#95a1ad']])}
      {lin('tog-hager', [[0, '#6b737c'], [1, '#262a2f']])}
      {lin('lcd', [[0, '#d2e8ae'], [1, '#98b86c']])}
      {lin('socket', [[0, '#ffffff'], [1, '#cfd3d8']])}
      {lin('body', [[0, '#ffffff'], [1, '#e3e6ea']], 0.4, 1)}
      {lin('cover', [[0, '#ffffff'], [0.6, '#f7f8f9'], [1, '#eceef1']])}
      {lin('side', [[0, '#d5dae0'], [1, '#9ea6af']], 1, 0)}
      {lin('bottom', [[0, '#c3c9d0'], [1, '#8e969f']])}
      {lin('opening', [[0, '#16191d'], [1, '#353b42']])}
      {lin('rail', [[0, '#8f99a4'], [0.14, '#eef1f4'], [0.3, '#b3bbc4'], [0.5, '#d9dee4'], [0.7, '#b3bbc4'], [0.86, '#f3f5f7'], [1, '#86909b']])}
      {lin('glass', [[0, '#ffffff', 0.55], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0]])}
      {lin('shade', [[0, '#000000', 0.45], [1, '#000000', 0]])}
      <radialGradient id={`${uid}-knob`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#9aa3ad" />
      </radialGradient>
      <filter id={`${uid}-blur`} x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <pattern id={`${uid}-railholes`} width="25" height="35" patternUnits="userSpaceOnUse">
        <rect x="6" y="15" width="13" height="5" rx="2.5" fill="#5b646e" opacity="0.55" />
      </pattern>
    </defs>
  );
}

/** Définitions seules, dans un SVG invisible (vignettes de la bibliothèque). */
export function SharedDefs({ uid }: { uid: string }) {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
      <BoardDefs uid={uid} />
    </svg>
  );
}
