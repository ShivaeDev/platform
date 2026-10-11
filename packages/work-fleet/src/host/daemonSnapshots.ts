import { Effect, PubSub } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { FleetHost } from "#host/config.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { type Snapshot, snapshotStream } from "#host/snapshotStream.ts";
import { FleetFailure } from "#policy.ts";

export const daemonSnapshots = Effect.fn("FleetDaemon.daemonSnapshots")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	const read = readWaitStates(host).pipe(
		Effect.provideService(SqlClient.SqlClient, sql),
		Effect.mapError(() => new FleetFailure({ message: "Fleet daemon could not read work states", reason: "integration" })),
	);
	const events = yield* PubSub.sliding<Snapshot>(1);
	let previous = "";
	yield* Effect.gen(function* () {
		while (true) {
			const next = yield* read.pipe(Effect.result);
			if (next._tag === "Failure") {
				yield* PubSub.publish(events, Effect.fail(next.failure));
			} else {
				const encoded = JSON.stringify(next.success);
				if (encoded !== previous) {
					previous = encoded;
					yield* PubSub.publish(events, Effect.succeed(next.success));
				}
			}
			yield* Effect.sleep("500 millis");
		}
	}).pipe(Effect.forkScoped);
	return (ids: readonly string[]) => snapshotStream(events, read, ids);
});
