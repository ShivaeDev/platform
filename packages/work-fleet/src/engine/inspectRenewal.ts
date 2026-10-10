import { Effect } from "effect";
import { validateResult } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { observeRenewal, priorBoardWork } from "#engine/observeRenewal.ts";
import { reserveRenewal } from "#engine/reserveRenewal.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function inspectRenewal(state: EngineState) {
	const { integrations, save } = state;
	return Effect.fn("Fleet.inspectRenewal")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		const previous = stored.value.result;
		if (previous !== undefined && (previous.kind === "no-change" || stored.value.outcome !== undefined)) {
			return stored;
		}
		const worker = stored.value.attempts.findLast((attempt) => attempt.role !== "reviewer");
		if (worker?.receipt === undefined) {
			if (previous !== undefined) {
				return yield* Effect.fail(
					new FleetFailure({ message: "Existing PR has no exact worker receipt; reconcile ownership before renewal", reason: "denied" }),
				);
			}
			return stored;
		}
		const prior = yield* priorBoardWork(stored.value, work);
		const { observation, observed } = yield* observeRenewal(state)(stored, worker, worker.receipt);
		const result = yield* integrations
			.result(prior, observation)
			.pipe(
				Effect.mapError(
					() => new FleetFailure({ message: "Existing worker result ownership is unavailable; reconcile before renewal", reason: "denied" }),
				),
			);
		yield* reserveRenewal(state)(previous, result);
		const validation: Effect.Effect<void, FleetFailure> = validateResult(observed.value, result);
		yield* validation.pipe(
			Effect.mapError(
				() =>
					new FleetFailure({
						message: "Observed PR scope exceeds prior preparation; retained its reservation pending an ownership decision",
						reason: "denied",
					}),
			),
		);
		return yield* save(observed, {
			...observed.value,
			result,
			resultObservations: previous === undefined ? observed.value.resultObservations : [...(observed.value.resultObservations ?? []), previous],
		});
	});
}
