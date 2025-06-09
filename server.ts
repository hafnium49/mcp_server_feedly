#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * Feedly MCP Server
 * 
 * This server provides access to Feedly's API for content discovery and research.
 * 
 * ## Complete Feedly Workflow
 * 
 * The Feedly tools work together to provide a comprehensive content discovery system:
 * 
 * ### 1. Entity Discovery (feedly_autocomplete)
 * Start by discovering entity IDs for topics you're interested in:
 * ```
 * feedly_autocomplete({ query: "artificial intelligence" })
 * ```
 * Returns entities with IDs like: nlp/f/topic/3000
 * 
 * ### 2. Content Search & Stream Discovery (feedly_search)
 * Use discovered entity IDs to find articles and discover stream IDs:
 * ```
 * feedly_search({
 *   entities: [{
 *     id: "nlp/f/topic/3000",
 *     label: "Artificial Intelligence",
 *     salience: "about"
 *   }]
 * })
 * ```
 * Returns articles with origin.streamId fields like: feed/http://feeds.feedburner.com/zdnet/
 * 
 * ### 3. Stream Collection (feedly_collect)
 * Use discovered stream IDs to collect all articles from specific feeds:
 * ```
 * feedly_collect({
 *   streamId: "feed/http://feeds.feedburner.com/zdnet/cell-phones",
 *   count: 20
 * })
 * ```
 * 
 * ### 4. Entity Details (feedly_entity_lookup)
 * Get comprehensive information about any entity:
 * ```
 * feedly_entity_lookup({ entity_id: "nlp/f/topic/3000" })
 * ```
 * 
 * ## Key Concepts
 * 
 * - **Entities**: Topics, companies, people, technologies with unique IDs
 * - **Streams**: RSS feeds, user categories, or publication buckets
 * - **Salience**: "mention" (articles mentioning) vs "about" (articles focused on)
 * - **Sources**: Where to search (defaults to all topics)
 * 
 * ## Common Entity ID Patterns
 * - Topics: nlp/f/topic/XXXX
 * - Companies: nlp/f/entity/gz:org:company-name
 * - Technologies: nlp/f/entity/wd:XXXXXXX
 * - People: nlp/f/entity/gz:per:person-name
 * 
 * ## Example: Finding AI Applications in Battery Research
 * 
 * 1. Discover battery entity: feedly_autocomplete({ query: "magnesium battery" })
 * 2. Discover AI entity: feedly_autocomplete({ query: "artificial intelligence" })
 * 3. Search for intersection: feedly_search({ entities: [batteryEntity, aiEntity] })
 * 4. Collect from relevant feeds: feedly_collect({ streamId: discoveredStreamId })
 */

const FEEDLY_BASE = 'https://api.feedly.com/v3';
const TOKEN = process.env.FEEDLY_TOKEN || '';

const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'accept': 'application/json',
};

/**
 * ## Troubleshooting
 * 
 * ### No results returned
 * - Check if FEEDLY_TOKEN environment variable is set
 * - Verify entity IDs are correct (use feedly_autocomplete first)
 * - Try broader salience ("mention" instead of "about")
 * 
 * ### Stream not found
 * - Use feedly_search to discover valid stream IDs
 * - Stream IDs are found in article.origin.streamId
 * - Not all feeds support direct collection
 * 
 * ### Rate limiting
 * - Feedly API has rate limits
 * - Use count parameter to limit results
 * - Implement pagination with continuation tokens
 */

// Create MCP server
const server = new McpServer({
  name: 'feedly',
  version: '1.0.0',
});

/**
 * Search API - POST /search/contents
 * 
 * Primary discovery tool for finding articles and stream IDs.
 * Supports both simple text queries and advanced entity-based searches.
 * 
 * Usage:
 * - Simple search: feedly_search({ query: "climate change" })
 * - Entity search: feedly_search({ entities: [{ id: "nlp/f/topic/3000", label: "AI", salience: "about" }] })
 * 
 * Returns articles with origin.streamId that can be used with feedly_collect
 */
server.tool(
  'feedly_search',
  'Search for articles in Feedly using entity IDs or text queries',
  { 
    query: z.string().optional().describe('Simple text search query'),
    entities: z.array(z.object({
      id: z.string().describe('Entity ID from feedly_autocomplete (e.g., nlp/f/entity/wd:15474348)'),
      label: z.string().describe('Entity label'),
      aliases: z.array(z.string()).optional().describe('Entity aliases'),
      type: z.string().optional().describe('Entity type (e.g., topic, org, etc.)'),
      salience: z.enum(['mention', 'about']).default('mention').describe('How important the entity should be in results')
    })).optional().describe('Array of entities to search for'),
    source: z.object({
      items: z.array(z.object({
        id: z.string(),
        label: z.string().optional(),
        type: z.string(),
        tier: z.string().optional(),
        description: z.string().optional()
      }))
    }).default({
      items: [{
        type: "publicationBucket",
        id: "discovery:all-topics",
        tier: "tier3"
      }]
    }).describe('Source streams to search in'),
    count: z.number().int().min(1).max(100).default(10).describe('Number of results to return'),
    newerThan: z.number().optional().describe('Timestamp in ms - return only articles newer than this'),
    olderThan: z.number().optional().describe('Timestamp in ms - return only articles older than this'),
    unreadOnly: z.boolean().default(false).describe('Return only unread articles'),
    continuation: z.string().optional().describe('Continuation token for pagination'),
    includeAiActions: z.boolean().default(true).describe('Include AI actions in results')
  },
  async ({ query, entities, source, count, newerThan, olderThan, unreadOnly, continuation, includeAiActions }) => {
    // If simple query is provided, use GET method
    if (query && !entities) {
      const params = new URLSearchParams({ 
        query: query,
        count: String(count),
        unreadOnly: String(unreadOnly)
      });
      
      if (newerThan) params.set('newerThan', String(newerThan));
      if (olderThan) params.set('olderThan', String(olderThan));
      if (continuation) params.set('continuation', continuation);
      
      const resp = await fetch(`${FEEDLY_BASE}/search/contents?${params.toString()}`, {
        method: 'GET',
        headers: HEADERS
      });
      
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    
    // For entity-based search, use POST method with layers
    const params = new URLSearchParams({ 
      count: String(count),
      unreadOnly: String(unreadOnly),
      includeAiActions: String(includeAiActions)
    });
    
    if (newerThan) params.set('newerThan', String(newerThan));
    if (olderThan) params.set('olderThan', String(olderThan));
    if (continuation) params.set('continuation', continuation);
    
    const body: any = { source };
    
    // Build layers from entities
    if (entities && entities.length > 0) {
      body.layers = entities.map(entity => ({
        parts: [{
          id: entity.id,
          label: entity.label,
          aliases: entity.aliases || [],
          type: entity.type || 'entity'
        }],
        type: 'matches',
        salience: entity.salience
      }));
    }
    
    const resp = await fetch(`${FEEDLY_BASE}/search/contents?${params.toString()}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

/**
 * Collect Articles API - GET /streams/contents
 * 
 * Collects articles from a specific stream (feed, category, or board).
 * Use stream IDs discovered through feedly_search results.
 * 
 * Common stream ID formats:
 * - RSS feeds: feed/http://example.com/rss
 * - User categories: user/xxx/category/yyy
 * - Tags: user/xxx/tag/zzz
 * 
 * Usage: feedly_collect({ streamId: "feed/http://feeds.feedburner.com/zdnet/", count: 20 })
 */
server.tool(
  'feedly_collect',
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

/**
 * Entity Lookup API - GET /entities/{entityId}
 * 
 * Gets detailed information about a specific entity (topic, company, person, etc).
 * Use entity IDs discovered through feedly_autocomplete.
 * 
 * Returns comprehensive data including:
 * - Description and aliases
 * - Wikipedia links
 * - Popularity scores
 * - Behavioral explanations
 * 
 * Usage: feedly_entity_lookup({ entity_id: "nlp/f/topic/3000" })
 */
server.tool(
  'feedly_entity_lookup',
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

/**
 * Autocomplete Entities API - GET /search/entities
 * 
 * Starting point for entity discovery. Searches for entities and AI models by keyword.
 * Returns entity IDs that can be used with other tools.
 * 
 * Entity types include:
 * - Topics (technologies, concepts)
 * - Organizations (companies, institutions)
 * - People (executives, researchers)
 * - Geographic locations
 * - Products and services
 * 
 * Usage: feedly_autocomplete({ query: "artificial intelligence", count: 5 })
 */
server.tool(
  'feedly_autocomplete',
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
  
  // Keep the process alive
  process.stdin.resume();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down Feedly MCP server...');
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.error('Shutting down Feedly MCP server...');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

/**
 * ## Complete Workflow Examples
 * 
 * ### Example 1: Tracking AI in Healthcare
 * ```
 * // Step 1: Discover entities
 * const aiEntities = await feedly_autocomplete({ query: "artificial intelligence" });
 * const healthEntities = await feedly_autocomplete({ query: "healthcare" });
 * 
 * // Step 2: Search for articles
 * const articles = await feedly_search({
 *   entities: [
 *     { id: aiEntities[0].id, label: aiEntities[0].label, salience: "about" },
 *     { id: healthEntities[0].id, label: healthEntities[0].label, salience: "mention" }
 *   ],
 *   count: 50
 * });
 * 
 * // Step 3: Collect from discovered feeds
 * const streamId = articles.items[0].origin.streamId;
 * const feedArticles = await feedly_collect({ streamId, count: 100 });
 * ```
 * 
 * ### Example 2: Company Research
 * ```
 * // Step 1: Find company entity
 * const companies = await feedly_autocomplete({ query: "OpenAI" });
 * 
 * // Step 2: Get detailed company info
 * const companyDetails = await feedly_entity_lookup({ entity_id: companies[0].id });
 * 
 * // Step 3: Find all articles about the company
 * const companyNews = await feedly_search({
 *   entities: [{ id: companies[0].id, label: "OpenAI", salience: "about" }],
 *   count: 100
 * });
 * ```
 * 
 * ### Example 3: Technology Trend Analysis
 * ```
 * // Step 1: Discover related technologies
 * const quantum = await feedly_autocomplete({ query: "quantum computing" });
 * const ml = await feedly_autocomplete({ query: "machine learning" });
 * 
 * // Step 2: Find intersection articles
 * const quantumML = await feedly_search({
 *   entities: [
 *     { id: quantum[0].id, label: quantum[0].label, salience: "about" },
 *     { id: ml[0].id, label: ml[0].label, salience: "mention" }
 *   ]
 * });
 * 
 * // Step 3: Analyze top sources
 * const sources = [...new Set(quantumML.items.map(a => a.origin.streamId))];
 * for (const source of sources.slice(0, 5)) {
 *   await feedly_collect({ streamId: source, count: 10 });
 * }
 * ```
 */
