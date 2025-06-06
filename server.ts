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

  // Search API - POST /search/contents
  server.tool(
    'feedly.search',
    { 
      layers: z.array(z.object({
        parts: z.array(z.object({
          aliases: z.array(z.string()).optional(),
          id: z.string(),
          label: z.string(),
          type: z.string()
        })),
        type: z.string(),
        salience: z.string()
      })).optional(),
      source: z.object({
        items: z.array(z.object({
          id: z.string(),
          label: z.string().optional(),
          type: z.string(),
          tier: z.string().optional(),
          description: z.string().optional()
        }))
      }).optional(),
      count: z.number().int().min(1).max(100).default(10),
      newerThan: z.number().optional(),
      olderThan: z.number().optional(),
      unreadOnly: z.boolean().default(false),
      continuation: z.string().optional(),
      includeAiActions: z.boolean().default(true)
    },
    async ({ layers, source, count, newerThan, olderThan, unreadOnly, continuation, includeAiActions }) => {
      const params = new URLSearchParams({ 
        count: String(count),
        unreadOnly: String(unreadOnly),
        includeAiActions: String(includeAiActions)
      });
      
      if (newerThan) params.set('newerThan', String(newerThan));
      if (olderThan) params.set('olderThan', String(olderThan));
      if (continuation) params.set('continuation', continuation);
      
      const body: any = {};
      if (layers) body.layers = layers;
      if (source) body.source = source;
      
      const resp = await fetch(`${FEEDLY_BASE}/search/contents?${params.toString()}`,
        {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  // Collect Articles API - GET /streams/contents
  server.tool(
    'feedly.collect',
    { 
      streamId: z.string(),
      count: z.number().int().min(1).max(100).default(20),
      newerThan: z.number().optional(),
      olderThan: z.number().optional(),
      continuation: z.string().optional(),
      includeAiActions: z.boolean().default(true),
      similar: z.boolean().default(true)
    },
    async ({ streamId, count, newerThan, olderThan, continuation, includeAiActions, similar }) => {
      const params = new URLSearchParams({ 
        streamId: streamId,
        count: String(count),
        includeAiActions: String(includeAiActions),
        similar: String(similar)
      });
      
      if (newerThan) params.set('newerThan', String(newerThan));
      if (olderThan) params.set('olderThan', String(olderThan));
      if (continuation) params.set('continuation', continuation);
      
      const resp = await fetch(`${FEEDLY_BASE}/streams/contents?${params.toString()}`, {
        headers: HEADERS,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  // Entity Lookup API - GET /entities/{entityId}
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

  // Autocomplete Entities API - GET /search/entities
  server.tool(
    'feedly.autocomplete',
    { 
      query: z.string(),
      count: z.number().int().default(10) 
    },
    async ({ query, count }) => {
      const params = new URLSearchParams({ 
        query: query,
        count: String(count) 
      });
      const resp = await fetch(`${FEEDLY_BASE}/search/entities?${params.toString()}`, { headers: HEADERS });
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

const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, '0.0.0.0');
