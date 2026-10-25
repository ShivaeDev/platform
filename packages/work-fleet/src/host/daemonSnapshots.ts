import { Effect, Schedule, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { AppChanges } from "@shivaedev/platform/server/appHost.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { withAnswerRequests } from "#host/answerRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { snapshotStream } from "#host/snapshotStream.ts";
import type { WatchState } from "#host/watchState.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export const daemonSnapshots = Effect.fn("FleetDaemon.daemonSnapshots")(function* (host: FleetHost, watch = false) {
	const sql = yield* SqlClient.SqlClient;
	const changes = yield* AppChanges;
	const dispatches = yield* dispatchStore(host.namespace);
	const answers = yield* answerStore(host.namespace);
	const read = Effect.gen(function* () {
		// Reading requests first keeps a completed handoff from exposing an older human wait.
		const requests = yield* answers.list();
		const current = withAnswerRequests(yield* readWaitStates({ ...host, watch }), requests);
		const states = watch ? withAnswerFailures(current, requests) : current;
		return dispatchStates(states, yield* dispatches.list(), watch);
	}).pipe(
		Effect.provideService(SqlClient.SqlClient, sql),
		Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 19 }),
		Effect.mapError(
			() =>
				new ServiceUnavailable({
					message: "Fleet daemon could not read work states after 20 consecutive attempts",
				}),
		),
	);
	const snapshots = yield* changes.stream([fleetRecords.list, { _tag: "List", collection: `${host.namespace}_records` }]).pipe(
		Stream.mapEffect(() => read),
		Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
		Stream.share({ capacity: 1, replay: 1, strategy: "sliding" }),
	);
	return (ids: readonly string[], continuous = false) => snapshotStream(snapshots, ids, continuous);
});

function withAnswerFailures(states: readonly WatchState[], requests: readonly AnswerRequest[]) {
	return states.map((state) => {
		const answer = requests.find((request) => request.work_id === state.workId && request.error !== null);
		if (answer === undefined || answer.error === null) {
			return state;
		}
		return {
			...state,
			answerFailure: { error: answer.error, id: answer.request_id },
		};
	});
}

function dispatchStates(states: readonly WatchState[], requests: readonly DispatchRequest[], watch: boolean) {
	const result = new Map<string, WatchState>(states.map((state) => [state.workId, state]));
	for (const request of requests) {
		const state = dispatchState(result.get(request.workId), request, watch);
		if (state !== undefined) {
			result.set(request.workId, state);
		}
	}
	return [...result.values()].sort((left, right) => left.workId.localeCompare(right.workId));
}

function dispatchState(state: WatchState | undefined, request: DispatchRequest, watch: boolean): WatchState | undefined {
	if (request.status === "completed") {
		return undefined;
	}
	if (request.status === "failed" && state !== undefined && state.stage !== "queued") {
		return watch ? { ...state, dispatch: request } : undefined;
	}
	return {
		...state,
		...(watch ? { dispatch: request } : {}),
		attentionOwner: request.status === "pending" ? "automation" : "orchestrator",
		blocker: request.status === "pending" ? "Dispatch recorded; preparing in the background" : `Dispatch failed: ${request.error}`,
		stage: request.status === "pending" ? "queued" : "waiting",
		workId: request.workId,
	};
}
