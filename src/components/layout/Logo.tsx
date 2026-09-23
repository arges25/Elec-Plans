/** Logo MG Elec & Plans (SVG inline : MG + éclair + petit plan). */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} role="img" aria-label="Logo MG Elec & Plans">
      <defs>
        <linearGradient id="mg-bolt-ui" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#facc15" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#111827" />
      <path fill="#ffffff" d="M84 250V90h46l40 78 40-78h46v160h-40v-92l-34 64h-24l-34-64v92z" />
      <path fill="none" stroke="#ffffff" strokeWidth="38" d="M419 118A74 74 0 1 0 431 180H364" />
      <path fill="none" stroke="#9ca3af" strokeWidth="12" strokeLinejoin="round" d="M112 300h290v130H112zM240 300v78M240 406v24M112 366h72" />
      <path fill="url(#mg-bolt-ui)" stroke="#111827" strokeWidth="8" strokeLinejoin="round" d="M356 258l-62 108h44l-28 92 94-128h-46l34-72z" />
    </svg>
  );
}

export function LogoFull({ dark = true, subtitle = true }: { dark?: boolean; subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={44} className="shrink-0 rounded-xl ring-1 ring-white/10" />
      <div className="min-w-0">
        <p className={`text-lg font-extrabold leading-tight tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
          MG Elec <span className="text-brand-400">&amp;</span> Plans
        </p>
        {subtitle && <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>Vos plans électriques, simplement.</p>}
      </div>
    </div>
  );
}
