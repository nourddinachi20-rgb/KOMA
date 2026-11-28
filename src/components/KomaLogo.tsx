import { motion } from 'framer-motion';

export function KomaLogo({
  className = 'h-7 w-7',
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  if (!animated) {
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
        <rect x="16" y="14" width="9" height="36" rx="2.5" fill="#F8F8FA" />
        <path d="M28 31.5L42.5 14H50L33.5 33.5L28 31.5Z" fill="#F8F8FA" />
        <path d="M29.5 32.5L35.5 30.5L50.5 50H41.5L29.5 32.5Z" fill="#D4D4DF" />
        <path d="M28 32L31 29L34 32L31 35L28 32Z" style={{ fill: 'var(--koma-accent, #FFFFFF)' }} />
      </svg>
    );
  }

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <motion.rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill="#07070A"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.5"
        initial={{ pathLength: 0, opacity: 0.25 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.75, ease }}
      />
      <motion.rect
        x="16"
        y="14"
        width="9"
        height="36"
        rx="2.5"
        fill="#F8F8FA"
        style={{ transformOrigin: '20.5px 50px' }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.16, ease }}
      />
      <motion.path
        d="M28 31.5L42.5 14H50L33.5 33.5L28 31.5Z"
        fill="#F8F8FA"
        initial={{ opacity: 0, x: 10, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.48, delay: 0.3, ease }}
      />
      <motion.path
        d="M29.5 32.5L35.5 30.5L50.5 50H41.5L29.5 32.5Z"
        fill="#D4D4DF"
        initial={{ opacity: 0, x: 10, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.48, delay: 0.36, ease }}
      />
      <motion.path
        d="M28 32L31 29L34 32L31 35L28 32Z"
        style={{ fill: 'var(--koma-accent, #FFFFFF)', transformOrigin: '31px 32px' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.25, 1], opacity: 1 }}
        transition={{ duration: 0.42, delay: 0.52, ease }}
      />
    </svg>
  );
}
