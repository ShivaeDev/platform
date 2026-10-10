import { Context, Effect, Layer, Schema } from "effect";
import { connect, failure, request } from "#providers/codexRpc.ts";
import { localAdapter } from "#providers/localAdapter.ts";
import { SessionTransport } from "#session/service.ts";

// The runtime owns execution; observer teardown only disconnects.
export const CodexLocalConfiguration = Schema.Struct({ endpoint: Schema.String, requestTimeoutMs: Schema.Finite.check(Schema.isGreaterThan(0)) });
export type CodexLocalConfiguration = typeof CodexLocalConfiguration.Type;

export class CodexLocalConfig extends Context.Service<CodexLocalConfig, CodexLocalConfiguration>()("@shivaedev/work-fleet/CodexLocalConfig") {}

// The installed CLI schema verifies these local methods; it provides no hosted transport contract.
export const codexLocalLayer = Layer.effect(SessionTransport)(
	Effect.gen(function* () {
		const config = yield* Schema.decodeUnknownEffect(CodexLocalConfiguration)(yield* CodexLocalConfig).pipe(
			Effect.mapError(() => failure("unavailable", "Local Codex configuration requires a finite positive request timeout")),
		);
		const connection = yield* connect(config.endpoint, config.requestTimeoutMs);
		yield* request(connection, config.requestTimeoutMs, "initialize", {
			capabilities: null,
			clientInfo: { name: "work-fleet", title: "Work Fleet", version: "0.0.0" },
		});
		yield* Effect.sync(() => connection.socket.send(JSON.stringify({ method: "initialized" })));
		return localAdapter(connection, config.requestTimeoutMs);
	}),
);
