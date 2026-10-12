import { Effect, Schedule, Stream } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetHost } from "#host/config.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { snapshotStream } from "#host/snapshotStream.ts";

export const daemonSnapshots = Effect.fn("FleetDaemon.daemonSnapshots")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	const read = readWaitStates(host).pipe(
		Effect.provideService(SqlClient.SqlClient, sql),
		Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 19 }),
		Effect.mapError(() => new ServiceUnavailable({ message: "Fleet daemon could not read work states after 20 consecutive attempts" })),
	);
	const snapshots = yield* Stream.tick("500 millis").pipe(
		Stream.mapEffect(() => read),
		Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	return (ids: readonly string[]) => snapshotStream(snapshots, ids);
});
