import { Effect, Schedule, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { AppChanges } from "@shivaedev/platform/appHost.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { snapshotStream } from "#host/snapshotStream.ts";
import type { State } from "#host/waitOutcome.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export const daemonSnapshots = Effect.fn("FleetDaemon.daemonSnapshots")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	const changes = yield* AppChanges;
	const dispatches = yield* dispatchStore(host.namespace);
	const read = Effect.gen(function* () {
		return dispatchStates(yield* readWaitStates(host), yield* dispatches.list());
	}).pipe(
		Effect.provideService(SqlClient.SqlClient, sql),
		Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 19 }),
		Effect.mapError(() => new ServiceUnavailable({ message: "Fleet daemon could not read work states after 20 consecutive attempts" })),
	);
	const snapshots = yield* changes.stream([fleetRecords.list, { _tag: "List", collection: `${host.namespace}_records` }]).pipe(
		Stream.mapEffect(() => read),
		Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	return (ids: readonly string[], continuous = false) => snapshotStream(snapshots, ids, continuous);
});

function dispatchStates(states: readonly (typeof State.Type)[], requests: readonly DispatchRequest[]) {
	const result = new Map<string, typeof State.Type>(states.map((state) => [state.workId, state]));
	for (const request of requests) {
		const state = result.get(request.workId);
		if (request.status === "completed" || (request.status === "failed" && state !== undefined && state.stage !== "prepared")) {
			continue;
		}
		result.set(request.workId, {
			attentionOwner: request.status === "pending" ? "automation" : "orchestrator",
			blocker: request.status === "pending" ? "Dispatch recorded; preparing in the background" : `Dispatch failed: ${request.error}`,
			stage: request.status === "pending" ? "dispatching" : "needs-human",
			workId: request.workId,
		});
	}
	return [...result.values()].sort((left, right) => left.workId.localeCompare(right.workId));
}
