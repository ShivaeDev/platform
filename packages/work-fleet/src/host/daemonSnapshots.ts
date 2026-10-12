import { Effect, Schedule, Stream } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { FleetHost } from "#host/config.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { snapshotStream } from "#host/snapshotStream.ts";
import { FleetFailure } from "#policy.ts";

export const daemonSnapshots = Effect.fn("FleetDaemon.daemonSnapshots")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	const read = readWaitStates(host).pipe(
		Effect.provideService(SqlClient.SqlClient, sql),
		Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 19 }),
		Effect.mapError(
			() => new FleetFailure({ message: "Fleet daemon could not read work states after 20 consecutive attempts", reason: "integration" }),
		),
	);
	const snapshots = yield* sql.reactive([`${host.namespace}_records`], read).pipe(
		Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	return (ids: readonly string[]) => snapshotStream(snapshots, ids);
});
