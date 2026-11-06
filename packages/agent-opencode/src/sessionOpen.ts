import { Effect, Option, Schema } from "effect";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { rawOf } from "#adapters/mapping.ts";
import { SessionResponse } from "#adapters/protocol.ts";
import { CONSTRAINED_AGENT, wireName } from "#adapters/wireName.ts";
import { opencodeFailure } from "#failure.ts";
import type { OpenSessionOptions } from "#options.ts";
import { Provider, type ProviderPort } from "#Provider.ts";

const decodeSession = Schema.decodeUnknownOption(SessionResponse);
export interface PromptSettings {
	readonly agent?: string;
	readonly model?: {
		readonly "modelID": string;
		readonly "providerID": string;
	};
	readonly system?: string;
	readonly variant?: string;
}
function namedModel(model: string): Effect.Effect<PromptSettings, BackendFailure> {
	const separator = model.indexOf("/");
	return separator === -1
		? Effect.fail(opencodeFailure(`model ${JSON.stringify(model)} names no provider; OpenCode reads a model as provider/model`))
		: Effect.succeed({ model: { "modelID": model.slice(separator + 1), "providerID": model.slice(0, separator) } });
}
export function promptSettings(options: OpenSessionOptions): Effect.Effect<PromptSettings, BackendFailure> {
	const constrained: PromptSettings = options.constrainedPrompt === undefined ? {} : { agent: CONSTRAINED_AGENT, system: options.constrainedPrompt };
	const variant = Option.match(options.effort, {
		onNone: (): PromptSettings => constrained,
		onSome: (effort) => ({ ...constrained, variant: effort }),
	});
	return Effect.map(options.model === undefined ? Effect.succeed({}) : namedModel(options.model), (named) => ({ ...named, ...variant }));
}
function onlyGivenTools(tools: OpenSessionOptions["tools"]) {
	return [
		{ action: "deny", pattern: "*", permission: "*" },
		...tools.map((tool) => ({ action: "allow", pattern: "*", permission: wireName(tool.name) })),
	];
}
function withoutOtherTools(server: ProviderPort, tools: OpenSessionOptions["tools"]) {
	const given = new Set(tools.map((tool) => tool.name));
	return server.tools.names.filter((name) => !given.has(name)).map((name) => ({ action: "deny", pattern: "*", permission: wireName(name) }));
}
function permissions(server: ProviderPort, options: OpenSessionOptions) {
	return options.constrainedPrompt === undefined ? withoutOtherTools(server, options.tools) : onlyGivenTools(options.tools);
}
export const openSession = Effect.fnUntraced(function* (options: OpenSessionOptions) {
	const server = yield* Provider;
	const query = { directory: options.cwd };
	return yield* Option.match(options.resume, {
		onNone: () =>
			server
				.post({ body: { permission: permissions(server, options) }, path: "/session", query })
				.pipe(Effect.map((response) => ["POST /session", response] as const)),
		onSome: (sessionId) =>
			server
				.get({ body: undefined, path: `/session/${sessionId}`, query })
				.pipe(Effect.map((response) => [`GET /session/${sessionId}`, response] as const)),
	});
});
export function sessionIdOf(route: string, response: unknown): Effect.Effect<string, BackendFailure> {
	return Option.match(decodeSession(response), {
		onNone: () => Effect.fail(opencodeFailure(`${route} returned no session`)),
		onSome: ({ id }) => Effect.succeed(id),
	});
}
export function sessionOpened(route: string, response: unknown, sessionId: string): AgentEvent {
	return {
		raw: rawOf(route, response),
		reference: sessionId,
		type: "session.opened",
	};
}
