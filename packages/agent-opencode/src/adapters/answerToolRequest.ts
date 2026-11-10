import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolRequest, CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Effect, Option, Schema } from "effect";
import type { ToolSessions } from "#toolSessions.ts";
import type { ToolDefinition } from "#tools.ts";
import { CALLER_CALL, CALLER_SESSION, TOOL_SERVER_NAME } from "#wireName.ts";

function listed(tool: ToolDefinition) {
	return {
		description: tool.description,
		inputSchema: { ...tool.inputSchema, type: "object" as const },
		name: tool.name,
	};
}
function said(text: string, ok: boolean): CallToolResult {
	return {
		content: [{ text, type: "text" as const }],
		isError: !ok,
	};
}
const decodeArguments = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));
function caller(args: unknown): {
	readonly rest: unknown;
	readonly session: string | undefined;
	readonly callId: string | undefined;
} {
	return Option.match(decodeArguments(args), {
		onNone: () => ({ callId: undefined, rest: args, session: undefined }),
		onSome: ({ [CALLER_SESSION]: session, [CALLER_CALL]: callId, ...rest }) => ({
			callId: typeof callId === "string" ? callId : undefined,
			rest,
			session: typeof session === "string" ? session : undefined,
		}),
	});
}
async function answerCall(sessions: ToolSessions, name: string, args: unknown): Promise<CallToolResult> {
	const { rest, session, callId } = caller(args);
	if (session === undefined) {
		return said(`the call named no ${CALLER_SESSION}, so platform cannot tell which session is asking`, false);
	}
	if (callId === undefined) {
		return said(`the call named no ${CALLER_CALL}, so platform cannot identify the provider call`, false);
	}
	const served = sessions.served(session);
	if (Option.isNone(served)) {
		return said(`platform serves no open session ${session}`, false);
	}
	const tool = served.value.get(name);
	if (tool === undefined) {
		return said(`session ${session} was given no tool named ${name}`, false);
	}
	const outcome = await tool(callId, rest);
	return said(outcome.text, outcome.ok);
}
const progressWhileOpen = Effect.fnUntraced(function* (send: (progress: number) => Promise<void>) {
	let progress = 0;
	const report = Effect.promise(() =>
		send(progress).then(() => {
			progress += 1;
		}),
	);
	yield* report;
	yield* Effect.forkScoped(Effect.forever(Effect.andThen(Effect.sleep(30_000), report)));
});
function answerWithProgress(sessions: ToolSessions, message: CallToolRequest, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const token = message.params._meta?.progressToken;
				if (token !== undefined) {
					yield* progressWhileOpen((progress) =>
						extra.sendNotification({ method: "notifications/progress", params: { progress, progressToken: token } }),
					);
				}
				return yield* Effect.promise(() => answerCall(sessions, message.params.name, message.params.arguments));
			}),
		),
		{ signal: extra.signal },
	);
}
// Omitting the session-id generator makes the transport stateless, so each request gets its own protocol server and nothing is carried between them.
export function answerToolRequest(tools: readonly ToolDefinition[], sessions: ToolSessions) {
	const list = tools.map(listed);
	return async (request: Request): Promise<Response> => {
		const server = new Server({ name: TOOL_SERVER_NAME, version: "0.0.0" }, { capabilities: { tools: {} } });
		server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: list }));
		server.setRequestHandler(CallToolRequestSchema, (message, extra) => answerWithProgress(sessions, message, extra));
		const transport = new WebStandardStreamableHTTPServerTransport();
		await server.connect(transport);
		const response = await transport.handleRequest(request);
		if (response.body === null) {
			await server.close();
			return response;
		}
		const reader = response.body.getReader();
		const body = new ReadableStream<Uint8Array>({
			async cancel() {
				await reader.cancel();
				await server.close();
			},
			async pull(controller) {
				try {
					const next = await reader.read();
					if (next.done) {
						await server.close();
						controller.close();
					} else {
						controller.enqueue(next.value);
					}
				} catch (error) {
					await server.close();
					controller.error(error);
				}
			},
		});
		return new Response(body, { headers: response.headers, status: response.status });
	};
}
