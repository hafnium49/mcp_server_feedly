from mcp.server.fastmcp import FastMCP
import httpx
import os
from urllib.parse import quote_plus

mcp = FastMCP("feedly", host="0.0.0.0", port=8080)

FEEDLY_BASE = "https://api.feedly.com/v3"
TOKEN = os.getenv("FEEDLY_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "accept": "application/json",
}

@mcp.tool(name="feedly.search",
          description="Full-text or NLP Layer search against Feedly work-space")
def search(query: str, count: int = 10) -> dict:
    """Return up to `count` articles that match the query."""
    params = {"count": str(count)}
    body = {"query": query}
    resp = httpx.post(f"{FEEDLY_BASE}/search/contents",
                       params=params, json=body, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()

@mcp.tool(name="feedly.collect",
          description="Fetch articles from a Feedly StreamID (team feed, board, …)")
def collect(stream_id: str,
            count: int = 20,
            continuation: str | None = None) -> dict:
    """StreamID example: enterprise/feedly/category/f74cc0…"""
    params = {"streamId": stream_id, "count": str(count)}
    if continuation:
        params["continuation"] = continuation
    resp = httpx.get(f"{FEEDLY_BASE}/streams/contents",
                     params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()

# --- NEW TOOLS ---------------------------------------------------------------
@mcp.tool(name="feedly.entity_lookup",
          description="Return metadata about a single NLP entity ID.")
def entity_lookup(entity_id: str) -> dict:
    """
    Look up a Feedly NLP entity by ID (example:
    'nlp/f/entity/gz:org:apple').  URL-encode the ID automatically.
    """
    encoded = quote_plus(entity_id)
    resp = httpx.get(f"{FEEDLY_BASE}/entities/{encoded}",
                     headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()

@mcp.tool(name="feedly.autocomplete",
          description="Suggest entity IDs that match a text prefix.")
def autocomplete_entities(prefix: str, count: int = 10) -> dict:
    """
    Autocomplete Feedly NLP entities.  Typical use: user types "Nvid"
    → get entity ID for Nvidia Corporation.
    """
    params = {"prefix": prefix, "count": str(count)}
    resp = httpx.get(f"{FEEDLY_BASE}/entities/autocomplete",
                     params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    # Run the MCP server over HTTP rather than the default stdio transport
    mcp.run(transport="streamable-http")
