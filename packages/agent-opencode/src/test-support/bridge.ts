import * as NodeServices from "@effect/platform-node/NodeServices";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Effect, Exit, Layer, Schema, Scope } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { opencode } from "#opencode.ts";
import { scriptedPeer } from "#test/peer.ts";
import { providerCommand } from "#test/providerCommand.ts";
import type { DirectTool } from "#tools.ts";

interface ToolCall {
	readonly args: unknown;
	readonly callId: string;
	readonly session: string;
}
function assignedTool(session: string, calls: ToolCall[], tool: DirectTool): DirectTool {
	return {
		...tool,
		call: (callId, args) =>
			Effect.sync(() => {
				calls.push({ args, callId, session });
				return { ok: true, text: session };
			}),
	};
}
const Configuration = Schema.fromJsonString(
	Schema.Struct({ mcp: Schema.Struct({ platform: Schema.Struct({ url: Schema.String }) }), plugin: Schema.Array(Schema.String) }),
);
export const bridge = storyKit({
	create: () =>
		Effect.gen(function* () {
			const peer = yield* scriptedPeer;
			const command = yield* providerCommand(peer.url);
			const calls: {
				session: string;
				callId: string;
				args: unknown;
			}[] = [];
			const tool = {
				call: (callId: string, args: unknown) =>
					Effect.sync(() => {
						calls.push({ args, callId, session: "catalogue" });
						return { ok: true, text: callId };
					}),
				description: "Answer for this session",
				inputSchema: { properties: {}, type: "object" },
				name: "answer",
			};
			const context = yield* Layer.build(
				opencode({
					command,
					constrainedPrompt: "Only use assigned tools",
					cwd: "/tmp",
					sessionTools: (request) => [assignedTool(request.operationId, calls, tool)],
					tools: [tool],
				}),
			);
			const backend = yield* Backend.pipe(Effect.provide(context));
			const config = yield* peer.configuration.pipe(Effect.flatMap(Schema.decodeUnknownEffect(Configuration)));
			const transport: Omit<StreamableHTTPClientTransport, "sessionId"> = new StreamableHTTPClientTransport(new URL(config.mcp.platform.url));
			const pluginUrl = config.plugin[0];
			if (pluginUrl === undefined) {
				return yield* Effect.die("provider received no caller plugin");
			}
			const { default: plugin }: typeof import("#adapters/opencodePlugin.config.ts") = yield* Effect.promise(() => import(pluginUrl));
			const hooks = yield* Effect.sync(() => plugin());
			const scopes = new Map<string, Scope.Closeable>();
			const client = new Client({ name: "scripted-opencode", version: "1" });
			yield* Effect.acquireRelease(
				Effect.promise(() => client.connect(transport)),
				() => Effect.promise(() => client.close()),
			);
			return { backend, calls, client, hooks, peer, scopes };
		}),
	layer: NodeServices.layer,
	name: "OpenCode session tools",
	outboundPassthrough: true,
	stages: ["backend"],
	verbs: (engine) => ({
		call: (session: string, callId: string) =>
			Effect.promise(async () => {
				const output = { args: { question: "which session?" } };
				await engine.hooks["tool.execute.before"]({ "callID": callId, "sessionID": session, tool: "platform_answer" }, output);
				return engine.client.callTool({ arguments: output.args, name: "answer" });
			}),
		calls: () => Effect.sync(() => [...engine.calls]),
		close: (name: string) => {
			const scope = engine.scopes.get(name);
			return scope === undefined ? Effect.die("session never opened") : Scope.close(scope, Exit.succeed(undefined));
		},
		request: () => engine.peer.request,
		start: (name: string) =>
			Effect.gen(function* () {
				const scope = yield* Effect.flatMap(Effect.scope, Scope.fork);
				engine.scopes.set(name, scope);
				return yield* engine.backend
					.start({ cwd: "/project", input: { parts: [{ text: name, type: "text" }] }, operationId: name })
					.pipe(Scope.provide(scope));
			}),
	}),
});
