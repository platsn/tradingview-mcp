@echo off
REM Safe launcher: reuse CDP; never close TradingView unless explicitly requested.
REM Usage: scripts\launch_tv_debug.bat [port] [--kill-existing]
setlocal
set "TV_MCP_PORT=%~1"
if "%TV_MCP_PORT%"=="" set "TV_MCP_PORT=9222"
node "%~dp0..\src\cli\index.js" launch --port "%TV_MCP_PORT%" %2
exit /b %errorlevel%
