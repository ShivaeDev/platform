import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function openFleetPullRequests(count: number) {
	return function* (state: EngineStory) {
		const { fleet, fixture } = running(state);
		for (let index = 1; index <= count; index += 1) {
			const id = `pr-${index}`;
			fixture.approveWork(id, `board-${id}`);
			yield* prepareWork(id).pipe(Effect.provideService(Fleet, fleet));
			yield* fleet.dispatch(id);
			finishWorkers(fixture);
			yield* fleet.reconcile(id);
		}
	};
}
export function preparedCandidates(count: number) {
	return function* (state: EngineStory) {
		const { fleet, fixture } = running(state);
		for (let index = 1; index <= count; index += 1) {
			const id = `candidate-${index}`;
			fixture.approveWork(id, `board-${id}`);
			yield* prepareWork(id).pipe(Effect.provideService(Fleet, fleet));
		}
	};
}
