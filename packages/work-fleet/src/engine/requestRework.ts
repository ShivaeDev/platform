import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function requestRework(state: EngineState) {
	return Effect.fn("Fleet.requestRework")(function* (
		stored: Versioned<FleetRecord>,
		body: string,
		responses?: readonly DecisionResponse[],
		mainRevision?: string,
	) {
		const record = stored.value;
		const published = record.decision?.published;
		return yield* state
			.save(stored, {
				...record,
				areaQueuedAt: state.policy.now(),
				attentionOwner: undefined,
				blocker: undefined,
				checks: undefined,
				conflictRepairs: mainRevision === undefined ? record.conflictRepairs : [...(record.conflictRepairs ?? []), mainRevision],
				decision: undefined,
				decisionAcknowledged: undefined,
				decisionPublished: undefined,
				mergeReadyAt: undefined,
				mergeReadyHead: undefined,
				prompt: [
					"Requested changes to the existing PR:",
					body,
					`Continue on the same branch and PR (${record.result?.kind === "change" ? record.result.pr : ""}). Do not open another PR.`,
					"Run focused tests with pnpm --filter <package> test <paths> and the root pnpm ready fast static gate (Biome lint and format checks, repository rules, the changelog check and typechecking). CI runs the full test suite, builds and package archive checks across its shards. Then push the changes and watch CI for the new head. Return the required FLEET_HEAD and final FLEET_PR report.",
				].join("\n\n"),
				responses: responses ?? record.responses,
				review: undefined,
				reviewSkippedHead: undefined,
				step: "repairing",
				supersededDecisions:
					responses !== undefined || published === undefined
						? record.supersededDecisions
						: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
			})
			.pipe(Effect.flatMap(closeDecisions(state)));
	});
}
