import { it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { smartCompile, compile, getErrors, check } from '../src/core/pine.js';

function fixture() {
  const state = { editor: true, model: true, version: 1, uri: 'script:own', markers: [], studies: ['s1'], polls: 0, actions: [] };
  const editor = { getModel: () => state.model ? { uri: state.uri, getVersionId: () => state.version } : null };
  const env = { editor: { getEditors: () => [editor], getModelMarkers: () => state.markers } };
  const container = { '__reactFiber$test': { memoizedProps: { value: { monacoEnv: env } } } };
  state.buttons = [{ textContent: 'Update on chart', offsetParent: {}, disabled: false, click: () => state.actions.push('update') }];
  const context = {
    document: { querySelector: () => state.editor ? container : null, querySelectorAll: () => state.buttons },
    window: { TradingViewApi: { _activeChartWidgetWV: { value: () => ({ getAllStudies: () => state.studies.map(id => ({ id })) }) } } },
  };
  const _deps = {
    ensurePineEditorOpen: async () => true,
    evaluate: async expression => vm.runInNewContext(expression, context),
    delay: async () => { state.polls++; state.onPoll?.(state.polls); },
    getClient: async () => ({ Input: { dispatchKeyEvent: async event => state.actions.push(event.type) } }),
  };
  return { state, _deps };
}

it('empty diagnostics and a newly added study remain explicitly unverified', async () => {
  const { state, _deps } = fixture();
  state.onPoll = () => { state.studies = ['s1', 's2']; };
  const result = await smartCompile({ _deps });
  assert.equal(result.success, false);
  assert.equal(result.action_dispatched, true);
  assert.equal(result.compiled, null);
  assert.equal(result.compilation_status, 'unverified');
  assert.equal(result.study_added, true);
  assert.equal(state.polls, 10);
  assert.deepEqual(state.actions, ['update']);
});

it('observes errors that appear after the first diagnostic poll', async () => {
  const { state, _deps } = fixture();
  state.onPoll = n => { if (n === 3) state.markers = [{ severity: 8, message: 'Unknown identifier', startLineNumber: 4 }]; };
  const result = await smartCompile({ _deps });
  assert.equal(result.compilation_status, 'editor_errors');
  assert.equal(result.success, false);
  assert.equal(result.errors[0].line, 4);
  assert.equal(state.polls, 3);
});

it('does not dispatch when diagnostics cannot be read at the start', async () => {
  const { state, _deps } = fixture();
  state.model = false;
  const result = await smartCompile({ _deps });
  assert.equal(result.action_dispatched, false);
  assert.equal(result.has_errors, null);
  assert.equal(result.compilation_status, 'diagnostics_unavailable');
  assert.deepEqual(state.actions, []);
});

it('losing the editor is reported as unknown diagnostics, never an empty error list', async () => {
  const { state, _deps } = fixture();
  state.onPoll = () => { state.editor = false; };
  const result = await smartCompile({ _deps });
  assert.equal(result.success, false);
  assert.equal(result.has_errors, null);
  assert.equal(result.diagnostics_available, false);
});

it('rejects attribution when the editor content or document changes mid-check', async () => {
  for (const field of ['version', 'uri']) {
    const { state, _deps } = fixture();
    state.onPoll = () => { state[field] = field === 'version' ? 2 : 'script:other'; };
    const result = await smartCompile({ _deps });
    assert.equal(result.compilation_status, 'source_changed');
    assert.equal(result.compiled, null);
  }
});

it('warnings stay separate from errors and are not called confirmed compilation', async () => {
  const { state, _deps } = fixture();
  state.markers = [{ severity: 4, message: 'Consider consistent calls' }];
  const inspected = await getErrors({ _deps });
  assert.equal(inspected.has_errors, false);
  assert.equal(inspected.warning_count, 1);
  const requested = await compile({ _deps });
  assert.equal(requested.compilation_status, 'unverified');
});

it('ignores hidden, disabled, and plain Save buttons and uses the compile shortcut', async () => {
  const { state, _deps } = fixture();
  state.buttons = [
    { textContent: 'Add to chart', offsetParent: null, click: () => assert.fail('hidden button') },
    { textContent: 'Update on chart', offsetParent: {}, disabled: true, click: () => assert.fail('disabled button') },
    { textContent: 'Save', offsetParent: {}, click: () => assert.fail('plain Save is not compile') },
  ];
  const result = await smartCompile({ _deps });
  assert.equal(result.button_clicked, 'keyboard_shortcut');
  assert.deepEqual(state.actions, ['keyDown', 'keyUp']);
});

it('getErrors fails explicitly for missing diagnostics', async () => {
  const { state, _deps } = fixture();
  state.markers = null;
  const result = await getErrors({ _deps });
  assert.equal(result.success, false);
  assert.equal(result.has_errors, null);
});

it('server compilation requires a successful envelope and a generated template', async () => {
  const invoke = payload => check({ source: 'public test fixture', _deps: {
    fetch: async () => ({ ok: true, json: async () => payload }),
  } });
  for (const payload of [null, {}, { success: false }, { success: true, result: {} },
    { success: true, result: { errors2: [] } }, { success: false, result: { ilTemplate: 'code' } }]) {
    const result = await invoke(payload);
    assert.equal(result.success, false);
    assert.equal(result.compiled, null);
  }
  const valid = await invoke({ success: true, result: { ilTemplate: 'compiled fixture', errors2: [] } });
  assert.equal(valid.compiled, true);
  assert.equal(valid.compilation_status, 'compiler_confirmed');
  const invalid = await invoke({ success: true, result: { ilTemplate: 'partial', errors2: [{ message: 'bad source' }] } });
  assert.equal(invalid.compiled, false);
  assert.equal(invalid.success, false);
});

it('server compilation surfaces HTTP failures', async () => {
  await assert.rejects(() => check({ source: 'fixture', _deps: {
    fetch: async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' }),
  } }), /429/);
});
