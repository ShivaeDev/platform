import { Effect, Schedule, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { readKeys } from "@shivaedev/effect-contract/keys.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { fleetRecords } from "#fleetRecords.ts";
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
	const snapshots = yield* sql.reactive([...readKeys([fleetRecords.list]), `${host.namespace}_records`], read).pipe(
		Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	return (ids: readonly string[], continuous = false) => snapshotStream(snapshots, ids, continuous);
});
