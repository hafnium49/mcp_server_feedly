import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function run(url: string, tool: string, args: Record<string, any> = {}) {
  const client = new Client({ name: 'feedly-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  const result = await client.callTool({ name: tool, arguments: args });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  const [,, tool, ...rest] = process.argv;
  const urlArgIndex = rest.indexOf('--url');
  let url = 'http://localhost:8080/mcp';
  if (urlArgIndex >= 0) {
    url = rest[urlArgIndex + 1];
    rest.splice(urlArgIndex, 2);
  }
  const argsIndex = rest.indexOf('--args');
  let args = {} as Record<string, any>;
  if (argsIndex >= 0) {
    args = JSON.parse(rest[argsIndex + 1]);
  }
  run(url, tool, args).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
