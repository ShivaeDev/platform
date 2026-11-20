import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { serveOpencode } from "#adapters/serveOpencode.ts";
import { unavailable } from "#failure.ts";
import type { OpencodeOptions } from "#options.ts";
import type { ToolSessions } from "#toolSessions.ts";
export const providerAddress = Effect.fnUntraced(function* (options: OpencodeOptions, tools: ToolSessions) {
	let endpoint: string | undefined;
	if (options.tools?.length) {
		const { answerToolRequest } = yield* Effect.tryPromise({ catch: unavailable, try: () => import("#adapters/answerToolRequest.ts") });
		const { serveToolRequests } = yield* Effect.tryPromise({ catch: unavailable, try: () => import("#adapters/serveToolRequests.ts") });
		endpoint = yield* serveToolRequests(answerToolRequest(options.tools, tools));
	}
	return yield* serveOpencode({
		command: options.command ?? "opencode",
		constrained: options.constrainedPrompt !== undefined,
		cwd: options.cwd,
		plugin: fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "../opencodePlugin.config.ts" : "../opencodePlugin.config.js", import.meta.url)),
		skills: options.skills,
		tools: endpoint,
	});
});
