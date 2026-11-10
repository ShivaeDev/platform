import { resolve } from "node:path";
import type { EffortLevel, Options, SessionStore } from "@anthropic-ai/claude-agent-sdk";
import type { StartRequest } from "@shivaedev/agent/run.ts";
import type { makeToolServer } from "#adapters/makeToolServer.ts";
import { TOOL_SERVER_NAME } from "#adapters/makeToolServer.ts";
import type { ClaudeOptions } from "#options.ts";

function harness(config: ClaudeOptions): Partial<Options> {
	if (config.systemPrompt !== undefined) {
		return { settingSources: [], strictMcpConfig: true, systemPrompt: config.systemPrompt, tools: [] };
	}
	return config.skills === undefined ? {} : { plugins: [{ path: config.skills, type: "local" }] };
}

export function sessionOptions(
	request: StartRequest,
	config: ClaudeOptions,
	store: SessionStore,
	effort: EffortLevel | undefined,
	resume: string | undefined,
	server: Awaited<ReturnType<typeof makeToolServer>> | undefined,
): Options {
	return {
		cwd: resolve(request.cwd),
		forwardSubagentText: true,
		permissionMode: "auto",
		sessionStore: store,
		sessionStoreFlush: "eager",
		settings: { env: { "CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS": "1" } },
		...(request.model === undefined ? {} : { model: request.model }),
		...(effort === undefined ? {} : { effort }),
		...(resume === undefined ? {} : { resume }),
		...(config.executable === undefined ? {} : { pathToClaudeCodeExecutable: config.executable }),
		...harness(config),
		...(server === undefined
			? {}
			: {
					allowedTools: (config.tools ?? []).map((tool) => `mcp__${TOOL_SERVER_NAME}__${tool.name}`),
					mcpServers: { [TOOL_SERVER_NAME]: { instance: server, name: TOOL_SERVER_NAME, type: "sdk" } },
				}),
	};
}
