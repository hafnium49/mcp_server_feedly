import express from 'express';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// Base URL for the Feedly API
const FEEDLY_BASE = 'https://api.feedly.com/v3';
// Your Feedly developer token from environment variables
const TOKEN = process.env.FEEDLY_TOKEN || '';

// Standard headers for all Feedly API requests
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'accept': 'application/json',
};

/**
 * Creates and configures an MCP server with tools for the Feedly API.
 * @returns {McpServer} The configured MCP server instance.
 */
function getServer() {
  const server = new McpServer({
    name: 'feedly',
    version: '1.0.0',
  });

  /**
   * Tool: feedly.search
   * Corresponds to Feedly API: POST /v3/search/contents
   * Docs: https://developer.feedly.com/v3/search/#search-for-articles
   * Searches for articles based on a query.
   */
  server.tool(
    'feedly.search',
    {
      query: z.string().describe("The search query."),
      count: z.number().int().default(10).describe("Number of articles to return."),
      newerThan: z.number().int().optional().describe("Timestamp in ms to fetch articles newer than."),
      olderThan: z.number().int().optional().describe("Timestamp in ms to fetch articles older than."),
      unreadOnly: z.boolean().optional().describe("If true, only returns unread articles."),
      continuation: z.string().optional().describe("Continuation ID for pagination."),
      includeAiActions: z.boolean().default(true).optional().describe("If true, includes AI actions in the response."),
    },
    async ({ query, count, newerThan, olderThan, unreadOnly, continuation, includeAiActions }) => {
      const params = new URLSearchParams({ count: String(count) });
      if (newerThan) params.set('newerThan', String(newerThan));
      if (olderThan) params.set('olderThan', String(olderThan));
      if (unreadOnly !== undefined) params.set('unreadOnly', String(unreadOnly));
      if (continuation) params.set('continuation', continuation);
      if (includeAiActions !== undefined) params.set('includeAiActions', String(includeAiActions));

      // Note: The official documentation specifies a complex JSON object for the POST body.
      // We are preserving the original code's simpler { "query": "..." } body, which appears to be
      // a supported (though undocumented) feature, while adding the documented query parameters.
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

  /**
   * Tool: feedly.collect
   * Corresponds to Feedly API: GET /v3/streams/contents
   * Docs: https://developer.feedly.com/v3/streams/#collect-articles
   * Collects articles from a specific stream (e.g., a feed, folder, or board).
   */
  server.tool(
    'feedly.collect',
    {
      streamId: z.string().describe("The ID of the stream to collect articles from."),
      count: z.number().int().default(20).describe("Number of articles to return."),
      continuation: z.string().optional().describe("Continuation ID for pagination."),
      newerThan: z.number().int().optional().describe("Timestamp in ms to fetch articles newer than."),
      olderThan: z.number().int().optional().describe("Timestamp in ms to fetch articles older than."),
      includeAiActions: z.boolean().default(true).optional().describe("If true, includes AI actions in the response."),
      similar: z.boolean().default(true).optional().describe("If true, includes the number of related entries."),
    },
    async ({ streamId, count, continuation, newerThan, olderThan, includeAiActions, similar }) => {
      const params = new URLSearchParams({ streamId: streamId, count: String(count) });
      if (continuation) params.set('continuation', continuation);
      if (newerThan) params.set('newerThan', String(newerThan));
      if (olderThan) params.set('olderThan', String(olderThan));
      if (includeAiActions !== undefined) params.set('includeAiActions', String(includeAiActions));
      if (similar !== undefined) params.set('similar', String(similar));

      const resp = await fetch(`${FEEDLY_BASE}/streams/contents?${params.toString()}`, {
        headers: HEADERS,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  /**
   * Tool: feedly.entity_lookup
   * Corresponds to Feedly API: GET /v3/entities/{entityId}
   * Docs: https://developer.feedly.com/v3/entities/#entity-lookup
   * Looks up information about a single NLP entity.
   */
  server.tool(
    'feedly.entity_lookup',
    { entityId: z.string().describe("The ID of the entity to look up (must be URL-encoded).") },
    async ({ entityId }) => {
      const encoded = encodeURIComponent(entityId);
      const resp = await fetch(`${FEEDLY_BASE}/entities/${encoded}`, { headers: HEADERS });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  /**
   * Tool: feedly.autocomplete
   * Corresponds to Feedly API: GET /v3/search/entities
   * Docs: https://developer.feedly.com/v3/entities/#autocomplete-entities
   * Provides autocompletion suggestions for entities.
   */
  server.tool(
    'feedly.autocomplete',
    {
      query: z.string().describe("The prefix or keyword to get suggestions for."),
      count: z.number().int().default(10).describe("Number of suggestions to return.")
    },
    async ({ query, count }) => {
      const params = new URLSearchParams({ query, count: String(count) });
      const resp = await fetch(`${FEEDLY_BASE}/search/entities?${params.toString()}`, { headers: HEADERS });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  );

  return server;
}

// --- Express Server Setup ---
const app = express();
app.use(express.json());

// Main MCP endpoint
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    // Ensure server and transport are closed when the client disconnects
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Disallow GET and DELETE requests to the MCP endpoint
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

// Start the server
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Feedly MCP server listening on http://0.0.0.0:${PORT}`);
});
