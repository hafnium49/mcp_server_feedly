import anyio
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def run(url: str, tool: str, args: dict[str, object] | None = None) -> None:
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool, args)
            print(result.model_dump())

if __name__ == "__main__":
    import argparse, json

    parser = argparse.ArgumentParser(description="Call a tool on the Feedly MCP server")
    parser.add_argument("tool", help="Tool name to invoke")
    parser.add_argument("--url", default="http://localhost:8080", help="Server base URL")
    parser.add_argument("--args", type=json.loads, default="{}", help="Tool arguments as JSON")
    opts = parser.parse_args()
    anyio.run(run, opts.url, opts.tool, opts.args)
