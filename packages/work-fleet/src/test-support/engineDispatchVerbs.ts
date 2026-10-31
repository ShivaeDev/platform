import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { executing } from "#model.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineDispatchVerbs(state: EngineStory) {
	function record(id: string) {
		return Effect.suspend(() => running(state).fleet.get(id)).pipe(Effect.map(({ value }) => value));
	}
	return {
		areaLane: (area: string) =>
			Effect.suspend(() => running(state).fleet.areaLanes([area])).pipe(Effect.map((lanes) => lanes.find((lane) => lane.area === area) ?? "no lane")),
		attemptsOf: (id: string) => record(id).pipe(Effect.map(({ attempts }) => attempts.length)),
		blockerOf: (id: string) => record(id).pipe(Effect.map(({ blocker }) => blocker ?? "no blocker")),
		executionOf: (id: string) => record(id).pipe(Effect.map((value) => (executing(value) ? "executing" : "not executing"))),
		firstAttemptOf: (id: string) =>
			record(id).pipe(
				Effect.map(({ attempts: [first] }) =>
					first === undefined ? "no attempt" : { operationId: first.operationId, receipt: first.receipt ?? "no receipt", status: first.status },
				),
			),
		mergedDeliveryOf: (id: string) =>
			record(id).pipe(Effect.map(({ mergedDelivery }) => (mergedDelivery === undefined ? "no merged delivery" : "merged delivery recorded"))),
		runningWorkIds: (ids: readonly string[]) =>
			Effect.gen(function* () {
				const records = yield* Effect.forEach(ids, (id) => running(state).fleet.get(id));
				return records.filter(({ value }) => value.step === "working").map(({ value }) => value.workId);
			}),
		statusText: () =>
			Effect.gen(function* () {
				return renderStatus(views((yield* running(state).fleet.list()).map(({ value }) => value)));
			}),
		stepOf: (id: string) => record(id).pipe(Effect.map(({ step }) => step)),
		workStages: (ids: readonly string[]) =>
			Effect.gen(function* () {
				return Object.fromEntries(
					yield* Effect.forEach(ids, (id) =>
						running(state)
							.fleet.get(id)
							.pipe(Effect.map(({ value }) => [id, value.step])),
					),
				);
			}),
		workState: (id: string) =>
			record(id).pipe(Effect.map(({ attempts, blocker, step }) => ({ attempts: attempts.length, blocker: blocker ?? "no blocker", step }))),
	};
}
