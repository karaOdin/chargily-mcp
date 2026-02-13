@echo off
REM Chargily MCP Client Launcher for Windows
REM This bridges Claude Desktop (stdio) to Chargily MCP Server (HTTP)

set MCP_SERVER_URL=%1
set MCP_TOKEN=%2

if "%MCP_TOKEN%"=="" (
    echo Error: Missing token
    echo Usage: chargily-mcp.cmd SERVER_URL TOKEN
    exit /b 1
)

REM Adjust this path to where your WSL Ubuntu is accessible
REM Or use direct Windows Node.js if server is accessible
node "\\wsl.localhost\Ubuntu\home\karaodin\chargily-mcp\packages\mcp-client\index.js" %MCP_SERVER_URL% %MCP_TOKEN%
