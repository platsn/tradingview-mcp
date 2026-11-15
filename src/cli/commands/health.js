import { register } from '../router.js';
import * as core from '../../core/health.js';
import { update } from '../../core/update.js';

register('status', {
  description: 'Check CDP connection to TradingView',
  handler: () => core.healthCheck(),
});

register('launch', {
  description: 'Launch TradingView with CDP enabled',
  options: {
    port: { type: 'string', short: 'p', description: 'CDP port (default 9222)' },
    'no-kill': { type: 'boolean', description: 'Keep existing instances (the default; overrides --kill-existing)' },
    'kill-existing': { type: 'boolean', description: 'Explicitly force-close TradingView before launch; save work first' },
  },
  handler: (opts) => core.launch({
    port: opts.port ? Number(opts.port) : undefined,
    kill_existing: opts['kill-existing'] === true && opts['no-kill'] !== true,
  }),
});

register('update', {
  description: 'Update to the latest version (git fast-forward + npm ci if deps changed)',
  handler: () => update({}),
});
