import { it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeIndicatorInputs } from '../src/core/input-sanitizer.js';
import { getStudyValues, getIndicator } from '../src/core/data.js';

it('study-value reads strip source payloads while retaining IDs, settings, and plotted values', async () => {
  const input = [{ id: 'study1', name: 'Own indicator', values: { POC: 105 },
    inputs: { text: 'short secret', length: 20, enabled: false, offset: 0,
      source: 'close', blob: 'x'.repeat(501), nested: { scriptSource: 'secret', color: '#fff' } } }];
  const result = await getStudyValues({ _deps: { evaluate: async () => input } });
  assert.deepEqual(result.studies, [{ id: 'study1', name: 'Own indicator', values: { POC: 105 },
    inputs: { length: 20, enabled: false, offset: 0, source: 'close', nested: { color: '#fff' } } }]);
  assert.equal(input[0].inputs.text, 'short secret', 'does not mutate source objects');
});

it('single-indicator reads apply the same filtering to [{id, value}] settings', async () => {
  const result = await getIndicator({ entity_id: 's', _deps: { evaluate: async () => ({ visible: true,
    inputs: [{ id: 'text', value: 'secret' }, { id: 'length', value: 30 }, { id: 'enabled', value: false }] }) } });
  assert.deepEqual(result.inputs, [{ id: 'length', value: 30 }, { id: 'enabled', value: false }]);
});

it('bounds oversized and recursive structures and rejects prototype keys', () => {
  const cycle = { length: 10 }; cycle.self = cycle;
  assert.ok(JSON.stringify(sanitizeIndicatorInputs(cycle)).length < 500);
  const clean = sanitizeIndicatorInputs(JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","length":2}'));
  assert.deepEqual(clean, { length: 2 });
  assert.ok(sanitizeIndicatorInputs(Array.from({ length: 1000 }, (_, i) => i)).length <= 200);
  assert.equal(sanitizeIndicatorInputs(undefined), null);
  assert.deepEqual(sanitizeIndicatorInputs({ value: null, bad: Infinity }), { value: null });
});
