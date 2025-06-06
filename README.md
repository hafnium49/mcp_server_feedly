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

Run the server over HTTP on port `8080`:

```bash
npx ts-node server.ts
```

The MCP discovery document will be available at `http://localhost:8080/.well-known/mcp/`.

## Using with Claude Desktop

To connect Claude Desktop directly to this server, open **File > Settings > Developer > Edit Config** and
create or update `claude_desktop_config.json` with an entry like:

```json
{
  "mcpServers": {
    "feedly": {
      "command": "npx",
      "args": [
        "ts-node",
        "/path/to/mcp_server_feedly/server.ts"
      ],
      "env": {
        "FEEDLY_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Replace the path with the location of `server.ts` on your system and supply your Feedly token in place of `YOUR_TOKEN_HERE`. Claude Desktop will use this command to start the Feedly MCP server when needed.
