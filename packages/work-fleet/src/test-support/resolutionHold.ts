import { Deferred, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";
import { BoardGateway } from "#policy.ts";

// Fleet resolves a recorded answer by reading its Board response, so holding those reads holds every resolution path.
export function resolutionHold() {
	const entered = Deferred.makeUnsafe<void>();
	const release = Deferred.makeUnsafe<void>();
	let blocked: Effect.Effect<boolean> | undefined;
	function board<TOut, E, R>(parts: Layer.Layer<TOut, E, R>) {
		return Layer.effect(BoardGateway)(
			Effect.map(BoardGateway, (original) => ({
				...original,
				readDecision: (input) =>
					Effect.gen(function* () {
						if (blocked !== undefined && (yield* blocked)) {
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(release);
						}
						return yield* original.readDecision(input);
					}),
			})),
		).pipe(Layer.provideMerge(parts));
	}
	const arm = Effect.fn("ResolutionHold.arm")(function* (host: FleetHost, workId: string, blocker: string) {
		const sql = yield* SqlClient.SqlClient;
		blocked = sql<{ readonly blocker: string | null }>`select blocker from ${sql(`${host.namespace}_records`)} where work_id = ${workId}`.pipe(
			Effect.map((rows) => rows[0]?.blocker === blocker),
			Effect.orDie,
		);
		return { entered: Deferred.await(entered), release: Deferred.succeed(release, undefined).pipe(Effect.asVoid) };
	});
	return { arm, board };
}
