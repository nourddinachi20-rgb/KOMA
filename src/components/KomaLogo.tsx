export function KomaLogo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill="#09090D"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
      />
      {/* Left vertical manga panel pillar */}
      <rect x="16" y="14" width="9" height="36" rx="2.5" fill="#F8F8FA" />
      {/* Upper angled slash blade */}
      <path d="M28 31.5L42.5 14H50L33.5 33.5L28 31.5Z" fill="#F8F8FA" />
      {/* Lower angled slash blade */}
      <path d="M29.5 32.5L35.5 30.5L50.5 50H41.5L29.5 32.5Z" fill="#D4D4DF" />
      {/* Champagne ink spark at cut */}
      <path d="M28 32L31 29L34 32L31 35L28 32Z" fill="#EAC278" />
    </svg>
  );
}
