import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import type { ClaudeTool } from "#options.ts";
export const TOOL_SERVER_NAME = "platform";
export async function makeToolServer(tools: readonly ClaudeTool[]) {
	const [{ McpServer }, { CallToolRequestSchema, ListToolsRequestSchema }] = await Promise.all([
		import("@modelcontextprotocol/sdk/server/mcp.js"),
		import("@modelcontextprotocol/sdk/types.js"),
	]);
	const namespace = randomUUID();
	const byName = new Map(tools.map((tool) => [tool.name, tool]));
	const server = new McpServer({ name: TOOL_SERVER_NAME, version: "0.0.0" });
	server.server.registerCapabilities({ tools: { listChanged: true } });
	server.server.setRequestHandler(ListToolsRequestSchema, () => ({
		tools: tools.map((tool) => ({
			"_meta": { "anthropic/alwaysLoad": true },
			description: tool.description,
			inputSchema: { ...tool.inputSchema, type: "object" as const },
			name: tool.name,
		})),
	}));
	server.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
		const tool = byName.get(request.params.name);
		const outcome =
			tool === undefined
				? { ok: false, text: `No tool named ${request.params.name}` }
				: await Effect.runPromise(tool.call(request.params.arguments, `${namespace}:${String(extra.requestId)}`), { signal: extra.signal });
		return { content: [{ text: outcome.text, type: "text" }], isError: !outcome.ok };
	});
	return server;
}
