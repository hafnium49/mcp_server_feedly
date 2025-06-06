# MCP Server for Feedly API

This repository contains a minimal [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) server that exposes selected Feedly API endpoints as MCP tools. The server provides the following tools:

- `feedly.search`
- `feedly.collect`
- `feedly.entity_lookup`
- `feedly.autocomplete`

These tools make it possible for MCP-aware language models to search and retrieve articles or NLP entity information from Feedly.

## Setup

1. Install dependencies using npm:

```bash
npm install
```

2. Export your Feedly authentication token so the server can call the Feedly API:

```bash
export FEEDLY_TOKEN=YOUR_TOKEN_HERE
```

## Running the server

Run the server over HTTP on port `8080` by default:

```bash
npx ts-node server.ts
```

You can override the port by setting the `PORT` environment variable:

```bash
PORT=8081 npx ts-node server.ts
```

The MCP discovery document will be available at `http://localhost:8080/.well-known/mcp/`.

## Using with Claude Desktop

To connect Claude Desktop directly to this server, open **File > Settings > Developer > Edit Config** and
create or update `claude_desktop_config.json` with an entry like:

```json
{
  "mcpServers": {
    "feedly": {
      "transport": "http",
      "enabled": true,
      "url": "http://localhost:8081/mcp",
      "command": "npx",
      "args": [
        "ts-node",
        "/path/to/mcp_server_feedly/server.ts"
      ],
      "env": {
        "FEEDLY_TOKEN": "YOUR_TOKEN_HERE",
        "PORT": "8081"
      }
    }
  }
}
```

`url` tells Claude Desktop where to reach the server. `command` and `args` allow the app to start it automatically. Replace the path with the location of `server.ts` on your system and set `FEEDLY_TOKEN` to your Feedly token. Set `PORT` if you want the server to listen on something other than `8080` and update `url` accordingly.

You can copy `claude_desktop_config.example.json` from this repository as a starting point.

## Running tests

Install the Python dependencies and run the test suite:

```bash
pip install -r requirements.txt
FEEDLY_TOKEN=xxxx pytest -q
```

These tests compile the TypeScript server and verify that the MCP discovery endpoint responds correctly.
=======
