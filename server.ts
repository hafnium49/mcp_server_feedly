#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const FEEDLY_BASE = 'https://api.feedly.com/v3';
const TOKEN = process.env.FEEDLY_TOKEN || '';

const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'accept': 'application/json',
};

// Create MCP server
const server = new McpServer({
  name: 'feedly',
  version: '1.0.0',
});

// Search API - POST /search/contents
server.tool(
  'feedly.search',
  'Search for articles in Feedly using advanced query syntax',
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
    })).optional().describe('Query layers for advanced search'),
    source: z.object({
      items: z.array(z.object({
        id: z.string(),
        label: z.string().optional(),
        type: z.string(),
        tier: z.string().optional(),
        description: z.string().optional()
      }))
    }).optional().describe('Source streams to search in'),
    count: z.number().int().min(1).max(100).default(10).describe('Number of results to return'),
    newerThan: z.number().optional().describe('Timestamp in ms - return only articles newer than this'),
    olderThan: z.number().optional().describe('Timestamp in ms - return only articles older than this'),
    unreadOnly: z.boolean().default(false).describe('Return only unread articles'),
    continuation: z.string().optional().describe('Continuation token for pagination'),
    includeAiActions: z.boolean().default(true).describe('Include AI actions in results')
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
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Collect Articles API - GET /streams/contents
server.tool(
  'feedly.collect',
  'Collect articles from a Feedly stream (AI Feed, Folder, or Board)',
  { 
    streamId: z.string().describe('The stream ID to collect from (e.g., user/xxx/category/yyy)'),
    count: z.number().int().min(1).max(100).default(20).describe('Number of articles to return'),
    newerThan: z.number().optional().describe('Timestamp in ms - return only articles newer than this'),
    olderThan: z.number().optional().describe('Timestamp in ms - return only articles older than this'),
    continuation: z.string().optional().describe('Continuation token for pagination'),
    includeAiActions: z.boolean().default(true).describe('Include AI actions in results'),
    similar: z.boolean().default(true).describe('Include similar articles count')
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
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Entity Lookup API - GET /entities/{entityId}
server.tool(
  'feedly.entity_lookup',
  'Look up details about a specific Feedly entity',
  { entity_id: z.string().describe('The entity ID to look up (will be URL encoded)') },
  async ({ entity_id }) => {
    const encoded = encodeURIComponent(entity_id);
    const resp = await fetch(`${FEEDLY_BASE}/entities/${encoded}`, { headers: HEADERS });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Autocomplete Entities API - GET /search/entities
server.tool(
  'feedly.autocomplete',
  'Get entity and AI model suggestions based on a query',
  { 
    query: z.string().describe('The keyword to match against entities and AI models'),
    count: z.number().int().default(10).describe('Number of suggestions to return')
  },
  async ({ query, count }) => {
    const params = new URLSearchParams({ 
      query: query,
      count: String(count) 
    });
    const resp = await fetch(`${FEEDLY_BASE}/search/entities?${params.toString()}`, { headers: HEADERS });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Feedly MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
