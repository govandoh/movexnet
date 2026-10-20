/**
 * Íconos de trazo (DEC-051: íconos, nunca emojis). Heredan el color con `currentColor`;
 * el tamaño lo pone el contenedor. Siempre decorativos: el texto o `aria-label` va aparte.
 */
import type { ReactNode } from 'react';

function Stroke({ children, width = 2 }: { children: ReactNode; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconToday = () => (
  <Stroke><circle cx="12" cy="12" r="8.5" strokeDasharray="2 3.3" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></Stroke>
);
export const IconCalendar = () => (
  <Stroke><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></Stroke>
);
export const IconFigure = () => (
  <Stroke width={2.2}><circle cx="12" cy="5" r="2.2" /><path d="M12 7.5v6M12 9l-4 3M12 9l4 3M12 13.5l-3 6M12 13.5l3 6" /></Stroke>
);
export const IconDumbbell = () => (
  <Stroke><path d="M6.5 6.5h11v11h-11z" /><path d="M4 9v6M20 9v6M2 11v2M22 11v2" /></Stroke>
);
export const IconUser = () => (
  <Stroke><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></Stroke>
);
export const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
);
export const IconBack = () => (
  <Stroke width={2.2}><path d="M15 18l-6-6 6-6" /></Stroke>
);
export const IconClose = () => (
  <Stroke width={2.2}><path d="M6 6l12 12M18 6L6 18" /></Stroke>
);
export const IconCheck = () => (
  <Stroke width={3}><path d="M5 12l5 5 9-10" /></Stroke>
);
export const IconLock = () => (
  <Stroke width={2.2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Stroke>
);
export const IconAssist = () => (
  <Stroke><circle cx="6" cy="7" r="2.2" /><circle cx="18" cy="7" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M8 8l3 8M16 8l-3 8M8.2 7h7.6" /></Stroke>
);
export const IconLevel = () => (
  <Stroke width={2.2}><path d="M3 12h18" /><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" /></Stroke>
);
export const IconTilted = () => (
  <Stroke width={2.2}><path d="M3 15L21 9" /><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" /></Stroke>
);
export const IconVoice = () => (
  <Stroke><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Stroke>
);
export const IconVoiceOff = () => (
  <Stroke><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6M16 9l6 6" /></Stroke>
);
export const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);
export const IconSwitchCamera = () => (
  <Stroke><path d="M20 7h-3a2 2 0 0 1-2-2V2" /><path d="M9 2H4a2 2 0 0 0-2 2v4" /><path d="M2 17v3a2 2 0 0 0 2 2h3" /><path d="M15 22h3a2 2 0 0 0 2-2v-3" /><circle cx="12" cy="12" r="3" /></Stroke>
);
export const IconArrowDown = () => (
  <Stroke width={2.4}><path d="M12 5v14M5 12l7 7 7-7" /></Stroke>
);
export const IconAlert = () => (
  <Stroke width={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Stroke>
);
export const IconTrendDown = () => (
  <Stroke width={2.2}><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></Stroke>
);
export const IconTarget = () => (
  <Stroke width={2.2}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></Stroke>
);
export const IconFlame = () => (
  <Stroke width={2.2}><path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 2-6 5-10z" /></Stroke>
);
export const IconBolt = () => (
  <Stroke width={2.2}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></Stroke>
);
export const IconSearch = () => (
  <Stroke width={2.2}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Stroke>
);
export const IconCube = () => (
  <Stroke><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></Stroke>
);
export const IconBulb = () => (
  <Stroke><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></Stroke>
);
export const IconChevron = () => (
  <Stroke width={2.2}><path d="M9 6l6 6-6 6" /></Stroke>
);

/**
 * Logo de MovexNet: cinco nodos voltaje unidos por líneas índigo que forman una "M" (DEC-058,
 * DEC-068). Misma geometría que `public/favicon.svg` y los PNG de `scripts/generate-icons.mjs`.
 */
export function MovexMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M8 32L8 8L20 21L32 8L32 32" fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[8, 32], [8, 8], [20, 21], [32, 8], [32, 32]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="var(--color-volt)" />
      ))}
    </svg>
  );
}
export const IconHelp = () => (
  <Stroke><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></Stroke>
);
