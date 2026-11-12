// Toolbench's Outpost app: the published results (results/toolbench.json in this copy of the repository,
// which Outpost updates on every new commit) and the workflow's runs, live (<outpost-workflow-graph>).
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const PAGE = 'ui://toolbench/main';
const server = new McpServer({ name: 'toolbench', version: '0.1.0' });
const results = () => JSON.parse(readFileSync(new URL('../results/toolbench.json', import.meta.url), 'utf8'));

server.registerResource('main', PAGE, { title: 'Toolbench', mimeType: 'text/html;profile=mcp-app' }, async () => ({
  contents: [{ uri: PAGE, mimeType: 'text/html;profile=mcp-app', text: readFileSync(new URL('./page.html', import.meta.url), 'utf8') }],
}));

server.registerTool(
  'toolbench',
  {
    description: "Toolbench's results: every local model's score, turns right, serious mistakes and wait when driving Darkgrade Studio by voice, best first. Shows the Toolbench page, where runs can be started and followed.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: PAGE }, 'outpost/cacheSeconds': 0 },
  },
  async () => {
    const { date, models, input } = results();
    const summary = {
      date,
      turns: input?.turns ?? 0,
      models: models.map((row: any) => ({
        id: row.id,
        name: row.name,
        maker: row.maker,
        score: row.score ?? null,
        turnsPassed: row.turnsPassed ?? null,
        seriousMistakes: row.seriousMistakes ?? null,
        decisionMedianMs: row.decisionMedianMs ?? null,
        modelClass: row.modelClass ?? null,
        sizeGigabytes: row.sizeGigabytes ?? null,
        error: row.error ?? null,
      })),
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary) }], structuredContent: summary };
  },
);

await server.connect(new StdioServerTransport());
