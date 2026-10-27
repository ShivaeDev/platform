import { Effect } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetCycleSnapshot, FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";

function sameSource(record: FleetRecord | FleetCycleSnapshot, work: BoardWork) {
	return record.boardSourcePath === work.sourcePath;
}

function delivered(cycle: FleetRecord | FleetCycleSnapshot) {
	return cycle.step === "done" || cycle.mergedDelivery !== undefined || (cycle.result?.kind === "change" && cycle.outcome !== undefined);
}

function refusal(workId: string, delivery: string) {
	return `id ${workId} was delivered in ${delivery}; give this brief a new id`;
}

export const deliveredIdProblem = Effect.fn("Fleet.deliveredIdProblem")(function* (state: EngineState, work: BoardWork) {
	const stored = yield* state.store.load(work.workId);
	if (
		stored !== undefined
		&& sameSource(stored.value, work)
		&& (!delivered(stored.value) || stored.value.attempts.some((attempt) => attempt.role !== "reviewer" && attempt.receipt !== undefined))
	) {
		return undefined;
	}
	const prior = [stored?.value, ...(stored?.value.history ?? [])].find((cycle) => cycle !== undefined && delivered(cycle));
	if (prior !== undefined) {
		return refusal(work.workId, prior.result?.kind === "change" ? prior.result.pr : `the done record for ${work.workId}`);
	}
	if (state.integrations.publication === undefined || state.board.sourceCreatedAt === undefined) {
		return undefined;
	}
	const publication = yield* state.integrations.publication(work);
	if (publication.pullRequestState !== "merged" || publication.pullRequest === undefined) {
		return undefined;
	}
	const createdAt = yield* state.board.sourceCreatedAt(work.sourcePath);
	if (createdAt !== undefined && publication.pullRequestCreatedAt !== undefined && createdAt <= publication.pullRequestCreatedAt) {
		return undefined;
	}
	return refusal(work.workId, publication.pullRequest);
});

export const refuseDeliveredId = Effect.fn("Fleet.refuseDeliveredId")(function* (state: EngineState, work: BoardWork) {
	const message = yield* deliveredIdProblem(state, work);
	if (message !== undefined) {
		return yield* new BadRequest({ message });
	}
});
