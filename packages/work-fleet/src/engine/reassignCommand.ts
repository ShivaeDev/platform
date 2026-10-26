import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { AttentionOwner } from "#attention.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { EngineState } from "#engine/makeState.ts";

export function reassignCommand(state: EngineState) {
	return Effect.fn("Fleet.reassign")(
		function* (workId: string, decisionId: string, attentionOwner: AttentionOwner) {
			let stored = yield* state.load(workId);
			if (stored.value.step !== "waiting" || stored.value.decision?.id !== decisionId) {
				const prior = stored.value.supersededDecisions?.find((receipt) => receipt.published.request === decisionId);
				if (prior?.reassignedTo?.attentionOwner === attentionOwner && prior.reassignedTo.decisionId === stored.value.decision?.id) {
					stored = yield* ensurePublication(state)(stored);
					return yield* closeDecisions(state)(stored);
				}
				return yield* Effect.fail(new Conflict({ message: "The waiting decision changed" }));
			}
			stored = yield* ensurePublication(state)(stored);
			const previous = stored.value.decision;
			if (previous?.published === undefined) {
				return yield* Effect.fail(new Conflict({ message: "Publish the current decision before reassignment" }));
			}
			if (stored.value.attentionOwner === attentionOwner && previous.attentionOwner === attentionOwner) {
				return yield* closeDecisions(state)(stored);
			}
			const decision = { ...previous, attentionOwner, id: `${workId}.${stored.version}`, published: undefined };
			stored = yield* state.save(stored, {
				...stored.value,
				attentionOwner,
				blocker: undefined,
				decision,
				decisionPublished: false,
				supersededDecisions: [
					...(stored.value.supersededDecisions ?? []),
					{ published: previous.published, reassignedTo: { attentionOwner, decisionId: decision.id }, supersededAt: state.policy.now() },
				],
			});
			stored = yield* ensurePublication(state)(stored);
			return yield* closeDecisions(state)(stored);
		},
		(effect) => effect.pipe(Effect.catchTag("StorageConflict", () => Effect.fail(new Conflict({ message: "The waiting decision changed" })))),
	);
}
