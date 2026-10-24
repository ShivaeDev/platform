import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";

export function openFleetPullRequests(count: number) {
	return engine.trait("work", `${count} Fleet PRs already await human delivery`, function* (state) {
		const { fleet, fixture } = running(state);
		for (let index = 1; index <= count; index += 1) {
			const id = `pr-${index}`;
			fixture.approveWork(id, `board-${id}`);
			yield* prepareWork(id).pipe(Effect.provideService(Fleet, fleet));
			yield* fleet.dispatch(id);
			finishWorkers(fixture);
			yield* fleet.reconcile(id);
		}
	});
}
export function preparedCandidates(count: number) {
	return engine.trait("work", `${count} approved candidates are prepared`, function* (state) {
		const { fleet, fixture } = running(state);
		for (let index = 1; index <= count; index += 1) {
			const id = `candidate-${index}`;
			fixture.approveWork(id, `board-${id}`);
			yield* prepareWork(id).pipe(Effect.provideService(Fleet, fleet));
		}
	});
}
