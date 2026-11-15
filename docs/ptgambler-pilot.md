# Development pilot

This branch adds reliability fixes to upstream commit `c05b8f5755ed8e64ea242de88ddbf46aa24d56a4`.
Keep `main` aligned with upstream. Use `ptgambler-dev` for these changes and pin a tested commit for installation.
No proprietary Pine scripts, credentials, or account data belong in this public repository.

## Changed behavior

- Boolean parameters accept JSON `true` and `false`. Strings such as `"false"`, numbers, and null are rejected before tool execution.
- `tv_launch` reuses a responding CDP endpoint and preserves existing processes by default. Force-closing requires explicit `kill_existing: true` or CLI `--kill-existing`. A startup timeout is a failure. Windows synchronous spawn errors reach the existing MSIX fallback; no sandbox-disabling flags are added.
- Windows, macOS, and Linux launch scripts use the same core launcher. Legacy `--no-kill` remains accepted and overrides `--kill-existing`.
- Indicator reads remove internal script payload keys and oversized strings, with depth and entry limits. Ordinary lengths, source selections, colors, booleans, zeroes, and plotted values remain available.
- `pine_compile` and `pine_smart_compile` distinguish dispatch from completion. They poll diagnostics, separate warnings from errors, and detect source/document changes. Missing diagnostics are unknown, not an empty error list. Without definitive completion evidence they return `success: false`, `compiled: null`, and `compilation_status: unverified`, even if a new study appears. Inspect the chart and console; do not keep recompiling merely to clear this status.
- `pine_check` reports compiler confirmation only for a successful response with a generated template. Unrecognized responses remain unverified. Server compilation does not prove application to a chart, runtime correctness, or predictive value.
- CLI structured failures produce a nonzero exit code. This includes an unverified compile result.

The bridge uses undocumented application interfaces. Offline tests validate the guards and response handling, not compatibility with a specific live TradingView Desktop build.

## Windows setup

Use a local MCP client, Git, Node.js 20 or 22, and TradingView Desktop. The client must be able to start a local stdio process; this repository does not provide a hosted HTTP MCP endpoint.

In PowerShell, from your chosen development directory:

```powershell
git clone --branch ptgambler-dev https://github.com/platsn/tradingview-mcp.git
cd tradingview-mcp
npm ci --ignore-scripts
npm run lint
npm run test:unit
git rev-parse HEAD
```

Record the commit printed by the last command. After validating that revision, use `git checkout --detach <that-commit>` to prevent accidental branch updates on the installed copy.

Register a local stdio server in your MCP client with these values (adapt the absolute path):

```json
{
  "command": "node",
  "args": ["C:\\dev\\tradingview-mcp\\src\\server.js"],
  "env": {
    "TV_CDP_HOST": "127.0.0.1",
    "TV_CDP_PORT": "9222"
  }
}
```

The surrounding configuration format depends on the MCP client. Keep the debug connection on loopback; do not expose port 9222 through a tunnel or firewall rule.

Save your TradingView work. Launch or reuse the debugging session:

```powershell
node src/cli/index.js launch
node src/cli/index.js status
```

If an existing instance was launched without debugging, close it manually after saving and retry. Windows Store/MSIX builds may still refuse debugging or fail after the local-copy fallback. Treat a failed health check as a blocker for the live pilot; do not disable Chromium's sandbox to force it to start.

## First live checks

1. Use a separate development chart layout and a disposable script you own. Record the TradingView build, MCP commit, symbol, timeframe, session, and chart type.
2. Read `chart_get_state` and capture a screenshot. Confirm the selected chart before retrieving data. `data_get_ohlcv` reads the active pane; its parameters are `count` and `summary`, not a separate symbol or timeframe.
3. Compile a small known-valid script, then an intentionally invalid copy. Check the Pine console, editor diagnostics, and chart manually. An `unverified` tool response requires observation; it does not mean the source failed compilation.
4. Load a development copy of one existing indicator. Compare its plotted values, lines, table, and zones against the visible chart. Confirm sensitive input blobs are absent from responses.
5. Change one input and repeat the comparison. Use explicit model/source and chart checks between actions; avoid concurrent calls that mutate the active chart.
6. Step through a small replay sample and record when outputs first become available. Replay does not establish live tick-by-tick behavior or prove that an indicator never repaints.

For substantive PtGambler indicator work, consult the private trading research guide and relevant original passages, independently validate the calculations, and assess performance claims separately. Those private research files stay outside this bridge repository.

## Tests and updates

`npm run test:unit` is offline. Windows launch paths are exercised with injected platform/process dependencies, including on Linux. CI also runs on Windows and Linux with Node 20 and 22.

Live compiler tests are opt-in and submit their public test fixtures to TradingView:

```powershell
$env:TV_MCP_LIVE_TESTS = "1"
node --test tests/pine_analyze.test.js tests/cli.test.js
Remove-Item Env:TV_MCP_LIVE_TESTS
```

`npm run test:e2e` requires a live desktop and can alter its chart/account state. It is not part of the offline pilot validation.

The upstream `tv_update` tool only updates `main`; it is unsuitable for this pinned development checkout. Review upstream changes, merge them into the development branch deliberately, rerun checks, and pin the next tested revision.

## Data handling

The local bridge returns data to your AI client. Source code, screenshots, or chart output requested by that client can enter its context. `pine_check` sends source to TradingView's compiler endpoint; script and alert operations can call TradingView services using the signed-in app. Local transport is not an assurance that all processing stays on your PC. TradingView account/data permissions and terms still apply.
