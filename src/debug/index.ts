// The only file main.tsx loads in development: installs the simulated clock and the AI failure wrappers.
// Reaches the panel through ./panel.tsx (lazy). Never imported in production builds (BR-24).
export { sim, wrapClock, wrapExtractor, wrapPdfSource } from './sim.ts';
