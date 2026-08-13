// Node-only entry point: everything in the browser-safe barrel (`index.ts`)
// plus the `fs`-based loaders. Import this from Node-side code (scripts, the
// CLI demo); import `.` / `index.ts` from browser code.

export * from './index';
export { loadRungCountFile, loadDailyPool, loadFullPool } from './loaders';
export type { SplitRungCount } from './loaders';
