import express from 'express';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const FEEDLY_BASE = 'https://api.feedly.com/v3';
const TOKEN = process.env.FEEDLY_TOKEN || '';

const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'accept': 'application/json',
};

function getServer() {
  const server = new McpServer({
    name: 'feedly',
    version: '1.0.0',
  });

  server.tool(
    'feedly.search',
    { query: z.string(), count: z.number().int().default(10) },
    async ({ query, count }) => {
      const params = new URLSearchParams({ count: String(count) });
      const resp = await fetch(`${FEEDLY_BASE}/search/contents?${params.toString()}`,
        {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  server.tool(
    'feedly.collect',
    { stream_id: z.string(), count: z.number().int().default(20), continuation: z.string().optional() },
    async ({ stream_id, count, continuation }) => {
      const params = new URLSearchParams({ streamId: stream_id, count: String(count) });
      if (continuation) params.set('continuation', continuation);
      const resp = await fetch(`${FEEDLY_BASE}/streams/contents?${params.toString()}`, {
        headers: HEADERS,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  server.tool(
    'feedly.entity_lookup',
    { entity_id: z.string() },
    async ({ entity_id }) => {
      const encoded = encodeURIComponent(entity_id);
      const resp = await fetch(`${FEEDLY_BASE}/entities/${encoded}`, { headers: HEADERS });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  server.tool(
    'feedly.autocomplete',
    { prefix: z.string(), count: z.number().int().default(10) },
    async ({ prefix, count }) => {
      const params = new URLSearchParams({ prefix, count: String(count) });
      const resp = await fetch(`${FEEDLY_BASE}/entities/autocomplete?${params.toString()}`, { headers: HEADERS });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

app.delete('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0');
