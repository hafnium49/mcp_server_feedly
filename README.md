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

Run the server over **stdio** so there is no network port to configure. Simply start it with:

```bash
npx ts-node server.ts
```

The process stays alive and communicates with clients via its standard input and output streams.

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

Claude Desktop communicates with the server over stdio, so there is no URL to configure. `command` and `args` tell the app how to start it. Replace the path with the location of `server.ts` on your system and set `FEEDLY_TOKEN` to your Feedly token.

You can copy `claude_desktop_config.example.json` from this repository as a starting point.

## Running tests

Install the Python dependencies and run the test suite:

```bash
pip install -r requirements.txt
FEEDLY_TOKEN=xxxx pytest -q
```
