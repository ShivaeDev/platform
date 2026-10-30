import { Effect, type Scope } from "effect";
import { McpClient, McpClientError, McpProtocol, McpSchema } from "effect/ai";
import { FetchHttpClient } from "effect/http";
import { type Engine, named, path } from "./host.ts";

const REFUSALS = new Map([
	[401, "unauthorized"],
	[403, "forbidden"],
	[503, "auth unavailable"],
]);

function failureOf(engine: Engine, error: McpClientError.McpClientError) {
	const { reason } = error;
	if (reason instanceof McpClientError.HttpError) {
		engine.refusal = { challenge: reason.wwwAuthenticate, status: reason.status };
		return REFUSALS.get(reason.status) ?? `HTTP ${reason.status}`;
	}
	if (reason instanceof McpClientError.ProtocolError) {
		return `refused: ${named(engine, reason.description ?? "no description")}`;
	}
	return `client failure: ${error.message}`;
}

function textOf(result: McpSchema.CallToolResult) {
	return result.content.map((block) => (block.type === "text" ? block.text : `${block.type} content`)).join(" ");
}

function decoded(text: string) {
	try {
		const value: unknown = JSON.parse(text);
		return typeof value === "string" ? value : text;
	} catch {
		return text;
	}
}

function connection(engine: Engine, name: string) {
	const client = engine.clients.get(name);
	if (client === undefined) {
		throw new Error(`${name}'s client is not connected`);
	}
	return client;
}

function connect(engine: Engine, token: string | undefined): Effect.Effect<McpClient.McpClient | string, never, Scope.Scope> {
	return McpClient.make({ name: "Story client", version: "1" }).pipe(
		Effect.provideServiceEffect(
			McpClient.Transport,
			McpClient.http({
				headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
				protocol: McpProtocol.v2026_07_28,
				url: engine.resource,
			}),
		),
		Effect.provide(FetchHttpClient.layer),
		Effect.catch((error) => Effect.succeed(failureOf(engine, error))),
	);
}

export function connects(engine: Engine, name: string) {
	return Effect.map(connect(engine, engine.tokens.get(name)), (client) => {
		if (typeof client === "string") {
			return client;
		}
		engine.clients.set(name, client);
		return "connected";
	});
}

export function clientVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		bearerFailureLogs: () => Effect.sync(() => engine.jwks.logs.filter(([message]) => message === "MCP authentication verification failed")),
		call: (name: string, tool: string) =>
			Effect.suspend(() => {
				tell(`${name}'s client calls ${tool}`);
				return connection(engine, name).callTool({ tool: new McpSchema.Tool({ inputSchema: { type: "object" }, name: tool }) });
			}).pipe(
				Effect.map((result) => (result.isError === true ? `failed: ${textOf(result)}` : `answered ${named(engine, decoded(textOf(result)))}`)),
				Effect.catch((error) => Effect.succeed(failureOf(engine, error))),
			),
		connects: (name: string) =>
			Effect.suspend(() => {
				tell(`${name}'s client connects to the MCP endpoint`);
				return connects(engine, name);
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
				Effect.catch((error) => Effect.succeed(failureOf(engine, error))),
			),
		oauthChallenge: () => Effect.sync(() => engine.refusal?.challenge ?? "no challenge"),
	};
}
