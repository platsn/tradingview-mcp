#!/bin/bash
# Usage: launch_tv_debug_mac.sh [port] [--kill-existing]
# All platform launchers share the non-destructive core implementation.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TV_MCP_PORT="${1:-9222}"
if [ "$#" -gt 0 ]; then shift; fi
exec node "$SCRIPT_DIR/../src/cli/index.js" launch --port "$TV_MCP_PORT" "$@"
