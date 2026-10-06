import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { PrepareWork } from "#fleet.ts";
import { executing } from "#model.ts";
import { FleetFailure } from "#policy.ts";
export function prepareCommand({ store, board, policy, save }: EngineState) {
	return Effect.fn("Fleet.prepare")(function* (input: PrepareWork) {
		const work = yield* board.get(input.workId);
		if (policy.approved[work.workId] !== work.revision) {
			return yield* Effect.fail(new FleetFailure({ message: "Current Board revision needs maintainer approval", reason: "denied" }));
		}
		if (!input.prompt.trim() || input.preparation.ownedPaths.length === 0) {
			return yield* Effect.fail(new FleetFailure({ message: "Preparation needs fixed prompt and owned paths", reason: "invalid" }));
		}
		const existing = yield* store.load(work.workId);
		if (existing !== undefined) {
			if (executing(existing.value) || existing.value.stage === "completed" || existing.value.attempts.length > 0) {
				return yield* Effect.fail(new FleetFailure({ message: "Only unattempted work can replace preparation", reason: "denied" }));
			}
			return yield* save(existing, {
				...existing.value,
				boardRevision: work.revision,
				cwd: input.cwd,
				decision: undefined,
				preparation: { ...input.preparation, validation: [...existing.value.preparation.validation, ...input.preparation.validation] },
				prompt: input.prompt,
				stage: "prepared",
			});
		}
		return yield* store.insert({
			attempts: [],
			boardRevision: work.revision,
			cwd: input.cwd,
			preparation: input.preparation,
			prompt: input.prompt,
			stage: "prepared",
			workId: work.workId,
		});
	});
}
