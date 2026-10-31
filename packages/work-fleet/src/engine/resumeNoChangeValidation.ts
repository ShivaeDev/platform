import { Effect } from "effect";
import { reviewSatisfied } from "#completion.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { EngineContext } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const resumeNoChangeValidation = Effect.fn("Fleet.resumeNoChangeValidation")(function* (stored: Versioned<FleetRecord>) {
	const state = yield* EngineContext;
	const record = stored.value;
	if (
		record.decision?.code !== "no-change-checks-unconfigured"
		|| record.result?.kind !== "no-change"
		|| !reviewSatisfied(record, record.result.head)
	) {
		return undefined;
	}
	const published = record.decision.published;
	return yield* state
		.save(stored, {
			...record,
			attentionOwner: undefined,
			blocker: undefined,
			decision: undefined,
			step: "validating",
			supersededDecisions:
				published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
});
