/**
 * @responsivejs/cli — programmatic surface of the `rjs` command line.
 * The binary is `rjs`; the brand is r$.
 */

export { main, defaultIo, type CliIo, type SharedOptions } from './main.js';
export { resolveDriver, findAgentBrowser, type DriverChoice, type ResolvedDriver } from './drivers.js';
export { DEFAULT_SELECTORS } from './commands/analyze.js';
