import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineDispatchVerbs(state: EngineStory) {
	return {
		runningWorkIds: (ids: readonly string[]) =>
			Effect.gen(function* () {
				const records = yield* Effect.forEach(ids, (id) => running(state).fleet.get(id));
				return records.filter(({ value }) => value.step === "working").map(({ value }) => value.workId);
			}),
		statusText: () =>
			Effect.gen(function* () {
				return renderStatus(views((yield* running(state).fleet.list()).map(({ value }) => value)));
			}),
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
	};
}
