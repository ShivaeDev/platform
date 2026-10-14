import { Effect, Result } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { approveDispatchedBrief } from "#engine/approveBrief.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { clearIntegrationRetry, readRetry, retryPending } from "#engine/readRetry.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import { assessPreparation } from "#preparation/compatibility.ts";
export function dispatchCommand(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	const { board, load, save, decision, integrations, policy } = state;
	const dispatchPrepared = Effect.fn("Fleet.dispatchPrepared")(function* (workId: string, prompt?: string) {
		let stored = yield* load(workId);
		const work = yield* board.get(workId);
		stored = yield* approveDispatchedBrief(state, stored, work, prompt);
		if (stored.value.stage !== "prepared") {
			return stored;
		}
		const released = yield* releaseClosedPreparation(state, stored, work);
		if (released !== undefined) {
			return released;
		}
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
		return yield* launch(stored, "worker", stored.value.prompt).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(workId);
					if (current.value.stage !== "prepared") {
						return current;
					}
					yield* save(current, {
						...current.value,
						admissionReady: !(error instanceof Forbidden),
						attentionOwner: failureOwner(error),
						blocker: failureMessage(error),
					});
					return yield* Effect.fail(error);
				}),
			),
		);
	});
	return Effect.fn("Fleet.dispatch")(function* (workId: string, prompt?: string) {
		const current = yield* load(workId);
		if (retryPending(state, current.value)) {
			return current;
		}
		if (current.value.integrationRetry !== undefined) {
			yield* save(current, { ...current.value, attentionOwner: undefined, blocker: undefined });
		}
		return yield* dispatchPrepared(workId, prompt).pipe(
			Effect.flatMap((updated) => clearIntegrationRetry(state, updated)),
			Effect.catch((error) =>
				Effect.gen(function* () {
					const retrying = yield* readRetry(state, yield* load(workId), error);
					return retrying === undefined ? yield* Effect.fail(error) : retrying;
				}),
			),
		);
	});
}
