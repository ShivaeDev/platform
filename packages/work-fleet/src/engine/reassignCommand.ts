import { Effect } from "effect";
import type { AttentionOwner } from "#attention.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { EngineState } from "#engine/makeState.ts";
import { FleetFailure } from "#policy.ts";

export function reassignCommand(state: EngineState) {
	return Effect.fn("Fleet.reassign")(function* (workId: string, decisionId: string, attentionOwner: AttentionOwner) {
		let stored = yield* state.load(workId);
		if (stored.value.stage !== "needs-human" || stored.value.decision?.id !== decisionId) {
			return yield* Effect.fail(new FleetFailure({ message: "The waiting decision changed", reason: "stale" }));
		}
		stored = yield* ensurePublication(state)(stored);
		const previous = stored.value.decision;
		if (previous?.published === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Publish the current decision before reassignment", reason: "stale" }));
		}
		if (stored.value.attentionOwner === attentionOwner) {
			return yield* closeDecisions(state)(stored);
		}
		const decision = { ...previous, attentionOwner, id: `${workId}.${stored.version}`, published: undefined };
		stored = yield* state.save(stored, {
			...stored.value,
			attentionOwner,
			blocker: undefined,
			decision,
			decisionPublished: false,
			supersededDecisions: [...(stored.value.supersededDecisions ?? []), { published: previous.published, supersededAt: state.policy.now() }],
		});
		stored = yield* ensurePublication(state)(stored);
		return yield* closeDecisions(state)(stored);
	});
}
