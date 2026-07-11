// Inline logo so the wordmark follows the current theme's foreground color
// and the book follows the accent (the static /logo.svg can't do either).
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 60" fill="none" className={className} role="img" aria-label="Trove">
      <g transform="translate(14, 2)">
        <g transform="rotate(15, 10, 28)">
          <rect x="0" y="0" width="16" height="52" rx="2" fill="var(--color-accent)" />
          <rect x="16" y="3" width="4" height="46" rx="1" fill="var(--color-foreground)" opacity="0.85" />
          <rect x="20" y="1" width="2" height="50" rx="0.5" fill="var(--color-accent-hover)" />
          <line x1="4" y1="8" x2="12" y2="8" stroke="var(--color-background)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          <line x1="4" y1="11" x2="10" y2="11" stroke="var(--color-background)" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
          <line x1="4" y1="42" x2="12" y2="42" stroke="var(--color-background)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        </g>
      </g>
      <text
        x="52"
        y="44"
        fontFamily="Georgia, 'Iowan Old Style', 'Times New Roman', serif"
        fontSize="40"
        fontWeight="600"
        letterSpacing="-0.5"
        fill="var(--color-foreground)"
      >
        Trove
      </text>
    </svg>
  );
}
