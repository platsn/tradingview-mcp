import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const schemas = new Map();
for (const file of await readdir(new URL('../src/tools/', import.meta.url))) {
  if (!file.endsWith('.js') || file.startsWith('_')) continue;
  const module = await import(`../src/tools/${file}`);
  for (const [name, register] of Object.entries(module)) {
    if (name.startsWith('register')) register({ tool: (name, _description, shape) => schemas.set(name, shape) });
  }
}

it('all exposed boolean parameters reject strings and numbers, preserving true/false', () => {
  const cases = { alert_delete: ['delete_all'], tv_launch: ['kill_existing'],
    indicator_toggle_visibility: ['visible'], data_get_ohlcv: ['summary'],
    data_get_pine_lines: ['verbose'], data_get_pine_labels: ['verbose'],
    data_get_pine_boxes: ['verbose'], ui_mouse_click: ['double_click'] };
  for (const [tool, keys] of Object.entries(cases)) for (const key of keys) {
    const schema = schemas.get(tool)[key];
    for (const invalid of ['false', 'true', '0', '1', 0, 1, null]) {
      assert.equal(schema.safeParse(invalid).success, false, `${tool}.${key}: ${invalid}`);
    }
    assert.equal(schema.parse(false), false);
    assert.equal(schema.parse(true), true);
  }
});

it('the MCP runtime rejects delete_all:"false" before invoking a handler', async () => {
  const server = new McpServer({ name: 'boolean-regression', version: '1' });
  const calls = [];
  // Use the production schema and a recording handler; never touch real alerts.
  server.tool('alert_delete', 'schema test', schemas.get('alert_delete'), async args => {
    calls.push(args); return { content: [{ type: 'text', text: 'recorded' }] };
  });
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const bad = await client.callTool({ name: 'alert_delete', arguments: { alert_id: 123, delete_all: 'false' } });
    assert.equal(bad.isError, true);
    assert.equal(calls.length, 0);
    await client.callTool({ name: 'alert_delete', arguments: { alert_id: 123, delete_all: false } });
    assert.deepEqual(calls, [{ alert_id: 123, delete_all: false }]);
    assert.equal(z.object(schemas.get('tv_launch')).parse({}).kill_existing, undefined);
  } finally { await client.close(); await server.close(); }
});
