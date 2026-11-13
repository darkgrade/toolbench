// Toolbench's Outpost app: the workflow's runs, live (<outpost-workflow-graph>), to start, follow and
// rerun them. The results themselves are published at darkgrade.com/toolbench, not shown here.
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const PAGE = 'ui://toolbench/main';
const SITE = 'https://darkgrade.com/toolbench/';
const server = new McpServer({ name: 'toolbench', version: '0.1.0' });
const published = () => JSON.parse(readFileSync(new URL('../results/toolbench.json', import.meta.url), 'utf8')).date;

server.registerResource('main', PAGE, { title: 'Toolbench', mimeType: 'text/html;profile=mcp-app' }, async () => ({
  contents: [{ uri: PAGE, mimeType: 'text/html;profile=mcp-app', text: readFileSync(new URL('./page.html', import.meta.url), 'utf8') }],
}));

server.registerTool(
  'toolbench',
  {
    description: "Shows Toolbench's runs page, where runs of the benchmark can be started, followed, cancelled and rerun. The results are published at darkgrade.com/toolbench.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: PAGE }, 'outpost/cacheSeconds': 0 },
  },
  async () => {
    const summary = { resultsPublished: published(), results: SITE };
    return { content: [{ type: 'text', text: JSON.stringify(summary) }], structuredContent: summary };
  },
);

await server.connect(new StdioServerTransport());
