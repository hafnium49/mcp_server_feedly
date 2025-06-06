import subprocess
import time
import anyio
import pytest

from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client


@pytest.fixture(scope="module")
def server_proc():
    proc = subprocess.Popen(["python", "server.py"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # wait for server to start
    for _ in range(20):
        try:
            import socket
            with socket.create_connection(("localhost", 8080), timeout=0.5):
                break
        except OSError:
            time.sleep(0.5)
    else:
        proc.terminate()
        proc.wait()
        raise RuntimeError("server did not start")
    yield proc
    proc.terminate()
    proc.wait()


@pytest.mark.anyio("asyncio")
async def test_list_tools(server_proc):
    async with streamablehttp_client("http://localhost:8080/mcp") as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.list_tools()
            names = [t.name for t in result.tools]
            assert "feedly.search" in names
