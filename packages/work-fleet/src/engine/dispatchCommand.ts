import { Effect, Result } from "effect";
import { approveDispatchedBrief } from "#engine/approveBrief.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { dispatchFailure } from "#engine/dispatchFailure.ts";
import { failureCode } from "#engine/failureCode.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { clearIntegrationRetry, retryPending } from "#engine/readRetry.ts";
import { refreshBrief } from "#engine/refreshBrief.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import type { DispatchNow, FleetRecord } from "#model.ts";
import { assessPreparation } from "#preparation/compatibility.ts";
import type { Versioned } from "#storage/model.ts";
export function dispatchCommand(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	const { board, load, save, decision, integrations, policy } = state;
	function rememberNow(stored: Versioned<FleetRecord>, now: DispatchNow | undefined) {
		const requested = requestedNow(stored.value, now);
		return requested === undefined ? Effect.succeed(stored) : save(stored, requested);
	}
	const dispatchPrepared = Effect.fn("Fleet.dispatchPrepared")(function* (workId: string, prompt?: string, now?: DispatchNow) {
		let stored = yield* load(workId);
		const work = yield* board.get(workId);
		stored = yield* refreshBrief(state, stored, work);
		stored = yield* approveDispatchedBrief(state, stored, work, prompt);
		if (stored.value.stage !== "prepared") {
			return stored;
		}
		const released = yield* releaseClosedPreparation(state, stored, work);
		if (released !== undefined) {
			return released;
		}
		stored = yield* rememberNow(stored, now);
		const authorized = yield* authorizeBriefContext(stored.value, work).pipe(Effect.result);
		if (Result.isFailure(authorized)) {
			return yield* decision(
				stored,
				failureCode(authorized.failure),
				authorized.failure.message,
				"Restore approval for work that is still needed, or release it",
				undefined,
				"maintainer",
			);
		}
		if (stored.value.launchRetry !== undefined && policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const assessment = yield* assessPreparation(stored.value.preparation, yield* integrations.main(stored.value.preparation));
		if (assessment._tag === "Reprepare") {
			return yield* decision(stored, assessment.code ?? "fleet-invalid", assessment.reason, "Prepare the affected scope again before dispatch");
		}
		if (
			assessment.preparation.baseRevision !== stored.value.preparation.baseRevision
			|| assessment.preparation.observedAt !== stored.value.preparation.observedAt
		) {
			stored = yield* save(stored, { ...stored.value, preparation: assessment.preparation });
		}
		return yield* launch(stored, "worker", stored.value.prompt);
	});
	return Effect.fn("Fleet.dispatch")(function* (workId: string, prompt?: string, now?: DispatchNow) {
		const current = yield* load(workId);
		if (retryPending(state, current.value)) {
			return current;
		}
		if (current.value.integrationRetry !== undefined) {
			yield* save(current, { ...current.value, attentionOwner: undefined, blocker: undefined });
		}
		return yield* dispatchPrepared(workId, prompt, now).pipe(
			Effect.flatMap((updated) => clearIntegrationRetry(state, updated)),
			Effect.catch((error) => dispatchFailure(state, workId, error)),
		);
	});
}

function requestedNow(record: FleetRecord, now: DispatchNow | undefined): FleetRecord | undefined {
	const current = record.dispatchNow;
	if (now === undefined || (current !== undefined && (current.ignoreAreas || !now.ignoreAreas))) {
		return undefined;
	}
	return { ...record, dispatchNow: now };
}
