import { Clock, Context, Effect, Layer, Schema } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { codexLive } from "#providers/codexLive.ts";
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
const CodexLocal = defineService({
	id: "Fleet/CodexLocal",
	initialize: Effect.gen(function* () {
		const config = yield* Schema.decodeUnknownEffect(CodexLocalConfiguration)(yield* CodexLocalConfig).pipe(
			Effect.mapError(() => failure("unavailable", "Local Codex configuration requires a finite positive request timeout")),
		);
		const url = yield* loopback(config.endpoint);
		const clock = yield* Clock.Clock;
		const live = codexLive(() => clock.currentTimeMillisUnsafe());
		const connection = yield* connect({ url }, config.requestTimeoutMs, live.notified);
		yield* initialize(connection, config.requestTimeoutMs, false);
		function rpc(method: string, params: unknown, mutation = false) {
			return request(connection, config.requestTimeoutMs, method, params, mutation);
		}
		const activity = live.activity(Effect.succeed(connection), config.requestTimeoutMs);
		return codexAdapter(rpc, {
			activity,
			beforeTurn: (input) =>
				activity
					.follow(input.sessionId)
					.pipe(Effect.as(input.access === "read-only" ? { approvalPolicy: "never", sandboxPolicy: { networkAccess: true, type: "readOnly" } } : {})),
			provisioning: "ready",
			sessionStarted: (sessionId) => live.followed(connection, sessionId),
			threadStart: (input) => ({
				...(input.access === "read-only"
					? { approvalPolicy: "never", config: { "sandbox_read_only.network_access": true }, sandbox: "read-only" }
					: {}),
				cwd: input.cwd,
				ephemeral: false,
				...(input.settings?.model === undefined ? {} : { model: input.settings.model }),
				...(input.settings?.serviceTier === undefined ? {} : { serviceTier: input.settings.serviceTier }),
			}),
		});
	}),
	methods: (adapter) => adapter,
	requires: [CodexLocalConfig],
});
export const codexLocalLayer = Layer.effect(SessionTransport)(CodexLocal).pipe(Layer.provide(CodexLocal.layer));
