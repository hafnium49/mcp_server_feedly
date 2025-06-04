# MCP Server for Feedly API

This repository contains a minimal [python-sdk](https://github.com/modelcontextprotocol/python-sdk) server that exposes selected Feedly API endpoints as MCP tools. The server provides the following tools:

- `feedly.search`
- `feedly.collect`
- `feedly.entity_lookup`
- `feedly.autocomplete`

These tools make it possible for MCP-aware language models to search and retrieve articles or NLP entity information from Feedly.

## Setup

1. Create and activate a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install mcp httpx python-dotenv
```

2. Export your Feedly authentication token so the server can call the Feedly API:

```bash
export FEEDLY_TOKEN=YOUR_TOKEN_HERE
```

## Running the server

Run the server over HTTP on port `8080`:

```bash
python server.py
```

The MCP discovery document will be available at `http://localhost:8080/.well-known/mcp/`.
