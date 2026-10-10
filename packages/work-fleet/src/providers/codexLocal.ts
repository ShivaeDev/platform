import { Context, Effect, Layer, Schema } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { connect, failure, initialize, request } from "#providers/codexRpc.ts";
import { SessionTransport } from "#session/service.ts";

// The runtime owns execution; observer teardown only disconnects.
export const CodexLocalConfiguration = Schema.Struct({ endpoint: Schema.String, requestTimeoutMs: Schema.Finite.check(Schema.isGreaterThan(0)) });
export type CodexLocalConfiguration = typeof CodexLocalConfiguration.Type;

function loopback(endpoint: string) {
	return Effect.try({
		catch: () => failure("unavailable", "Invalid local Codex endpoint"),
		try: () => new URL(endpoint),
	}).pipe(
		Effect.filterOrFail(
			(url) => url.protocol === "ws:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.username === "" && url.password === "",
			() => failure("unavailable", "Local Codex requires an explicitly configured loopback WebSocket endpoint"),
		),
	);
}
export class CodexLocalConfig extends Context.Service<CodexLocalConfig, CodexLocalConfiguration>()("@shivaedev/work-fleet/CodexLocalConfig") {}

// The installed CLI schema verifies these local methods; it provides no hosted transport contract.
export const codexLocalLayer = Layer.effect(SessionTransport)(
	Effect.gen(function* () {
		const config = yield* Schema.decodeUnknownEffect(CodexLocalConfiguration)(yield* CodexLocalConfig).pipe(
			Effect.mapError(() => failure("unavailable", "Local Codex configuration requires a finite positive request timeout")),
		);
		const url = yield* loopback(config.endpoint);
		const connection = yield* connect({ url }, config.requestTimeoutMs);
		yield* initialize(connection, config.requestTimeoutMs, false);
		function rpc(method: string, params: unknown, mutation = false) {
			return request(connection, config.requestTimeoutMs, method, params, mutation);
		}
		const resumed = new Set<string>();
		return codexAdapter(rpc, {
			beforeTurn: (input) =>
				resumed.has(input.sessionId)
					? Effect.succeed({})
					: rpc("thread/resume", { excludeTurns: true, threadId: input.sessionId }).pipe(
							Effect.tap(() => Effect.sync(() => resumed.add(input.sessionId))),
							Effect.as({}),
						),
			provisioning: "ready",
			sessionStarted: (sessionId) => resumed.add(sessionId),
			threadStart: (input) => ({
				cwd: input.cwd,
				ephemeral: false,
				...(input.settings?.model === undefined ? {} : { model: input.settings.model }),
				...(input.settings?.serviceTier === undefined ? {} : { serviceTier: input.settings.serviceTier }),
			}),
		});
	}),
);
