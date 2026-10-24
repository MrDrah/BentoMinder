// Marker strings of the dev-only debug module. scripts/check-no-debug.mjs fails the build if
// either appears anywhere in dist/ (BR-24, US-E11-01/AC2).
export const DEBUG_MARKER = '__BENTOMINDER_DEBUG__';
export const DEBUG_PANEL_MARKER = 'BM_DEBUG_PANEL';
