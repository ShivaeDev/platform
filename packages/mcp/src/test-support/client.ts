import { Effect, Schema } from "effect";
import { McpClient, McpClientError, McpProtocol, McpSchema } from "effect/ai";
import { FetchHttpClient } from "effect/http";
import { type Engine, named, path } from "./host.ts";
import { AdminAnswer } from "./tools.ts";

const REFUSALS = new Map([
	[401, "unauthorized"],
	[403, "forbidden"],
	[503, "auth unavailable"],
]);

function failureOf(engine: Engine, error: McpClientError.McpClientError) {
	const { reason } = error;
	if (reason instanceof McpClientError.HttpError) {
		const refusal = REFUSALS.get(reason.status);
		if (refusal === undefined) {
			return Effect.fail(error);
		}
		engine.refusal = { challenge: reason.wwwAuthenticate, status: reason.status };
		return Effect.succeed(refusal);
	}
	return Effect.fail(error);
}

function callFailure(
	engine: Engine,
	tool: string,
	error: McpClientError.McpClientError,
): Effect.Effect<string | { refused: string; tool: string } | { failed: string }, McpClientError.McpClientError> {
	const { reason } = error;
	if (reason instanceof McpClientError.ProtocolError && reason.code === -32_602 && reason.description === `Tool '${tool}' not found`) {
		return Effect.succeed({ refused: "tool not found", tool });
	}
	if (tool === "refuse" && reason instanceof McpClientError.ToolError) {
		const [content] = reason.result.content;
		if (reason.result.content.length === 1 && content?.type === "text" && content.text === "Application refused") {
			return Effect.succeed({ failed: content.text });
		}
	}
	return failureOf(engine, error);
}

function connection(engine: Engine, name: string) {
	const client = engine.clients.get(name);
	if (client === undefined) {
		throw new Error(`${name}'s client is not connected`);
	}
	return client;
}

function connect(engine: Engine, token: string | undefined, scheme = "Bearer") {
	return McpClient.make({ name: "Story client", version: "1" }).pipe(
		Effect.provideServiceEffect(
			McpClient.Transport,
			McpClient.http({
				headers: token === undefined ? {} : { authorization: `${scheme} ${token}` },
				protocol: McpProtocol.v2026_07_28,
				url: `${engine.baseUrl}/mcp`,
			}),
		),
		Effect.provide(FetchHttpClient.layer),
		Effect.catch((error) => failureOf(engine, error)),
	);
}

export function connects(engine: Engine, name: string, scheme = "Bearer") {
	return Effect.map(connect(engine, engine.tokens.get(name), scheme), (client) => {
		if (typeof client === "string") {
			return client;
		}
		engine.clients.set(name, client);
		return "connected";
	});
}

export function clientVerbs(engine: Engine, tell: (line: string) => void) {
	function call(name: string, tool: string, args: Record<string, unknown> = {}) {
		return Effect.suspend(() => {
			tell(`${name}'s client calls ${tool}`);
			return connection(engine, name).callTool({
				arguments: args,
				schema: Schema.Union([Schema.String, AdminAnswer]),
				tool: new McpSchema.Tool({ inputSchema: { type: "object" }, name: tool }),
			});
		}).pipe(
			Effect.map((answer) => ({
				answered: typeof answer === "string" ? named(engine, answer) : { ...answer, caller: named(engine, answer.caller) },
			})),
			Effect.catch((error) => callFailure(engine, tool, error)),
		);
	}

	return {
		bearerFailureLogs: () => Effect.sync(() => engine.jwks.logs.filter(([message]) => message === "MCP authentication verification failed")),
		call,
		callsWithInvalidArguments: (name: string) =>
			call(name, "adminOnly", { request: { count: "two", flags: [], message: "hello" } }).pipe(
				Effect.catchReason("McpClientError", "ToolError", (reason) => Effect.succeed({ clientFailure: reason.message })),
			),
		connects: (name: string, scheme = "Bearer") =>
			Effect.suspend(() => {
				tell(`${name}'s client connects to the MCP endpoint`);
				return connects(engine, name, scheme);
			}),
		connectsWithoutToken: () =>
			Effect.suspend(() => {
				tell("a client without a token connects to the MCP endpoint");
				return connect(engine, undefined);
			}).pipe(Effect.map((client) => (typeof client === "string" ? client : "connected"))),
		lastRefusal: () =>
			Effect.sync(() => {
				if (engine.refusal === undefined) {
					return "nothing refused";
				}
				const { challenge, status } = engine.refusal;
				const refused = REFUSALS.get(status) ?? `HTTP ${status}`;
				const pointer = challenge?.match(/^Bearer resource_metadata="(?<url>[^"]+)"$/u)?.groups?.url;
				return pointer === undefined
					? `${refused} without a resource metadata pointer: ${challenge ?? "no challenge"}`
					: `${refused}, pointed to the resource metadata at ${path(engine, pointer)}`;
			}),
		listTools: (name: string) =>
			Effect.suspend(() => {
				tell(`${name}'s client lists its tools`);
				return connection(engine, name).listTools();
			}).pipe(
				Effect.map((tools): readonly string[] | string => tools.map((tool) => tool.name)),
				Effect.catch((error) => failureOf(engine, error)),
			),
		oauthChallenge: () => Effect.sync(() => engine.refusal?.challenge ?? "no challenge"),
	};
}
