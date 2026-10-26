import { Effect } from "effect";
import { Forbidden } from "@shivaedev/contract/errors/taxonomy.ts";
import { validateResult } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { observeRenewal, priorBoardWork } from "#engine/observeRenewal.ts";
import { reserveRenewal } from "#engine/reserveRenewal.ts";
import type { FleetError } from "#errors.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function inspectRenewal(state: EngineState) {
	const { integrations, save } = state;
	return Effect.fn("Fleet.inspectRenewal")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		if (stored.value.step === "released") {
			return stored;
		}
		if (stored.value.deliverable === "report") {
			return yield* inspectReportRenewal(stored);
		}
		const previous = stored.value.result;
		if (renewalSettled(stored.value)) {
			return stored;
		}
		const worker = stored.value.attempts.findLast((attempt) => attempt.role !== "reviewer");
		if (worker?.receipt === undefined) {
			if (previous !== undefined) {
				return yield* Effect.fail(new Forbidden({ message: "Existing PR has no exact worker receipt; reconcile ownership before renewal" }));
			}
			return stored;
		}
		const prior = yield* priorBoardWork(stored.value, work);
		const { observation, observed } = yield* observeRenewal(state)(stored, worker, worker.receipt);
		const result = yield* integrations
			.result(prior, observation)
			.pipe(Effect.mapError(() => new Forbidden({ message: "Existing worker result ownership is unavailable; reconcile before renewal" })));
		yield* reserveRenewal(state)(previous, result);
		const validation: Effect.Effect<void, FleetError> = validateResult(observed.value, result);
		yield* validation.pipe(
			Effect.mapError(
				() => new Forbidden({ message: "Observed PR scope exceeds prior preparation; retained its reservation pending an ownership decision" }),
			),
		);
		return yield* save(observed, {
			...observed.value,
			result,
			resultObservations: previous === undefined ? observed.value.resultObservations : [...(observed.value.resultObservations ?? []), previous],
		});
	});
}

function inspectReportRenewal(stored: Versioned<FleetRecord>) {
	if (stored.value.step === "released") {
		return Effect.succeed(stored);
	}
	const latest = stored.value.attempts.at(-1);
	return stored.value.report === undefined && latest?.status === "completed" && latest.output?.trim()
		? Effect.fail(new Forbidden({ message: "Reconcile the report before renewing preparation" }))
		: Effect.succeed(stored);
}

function renewalSettled(record: FleetRecord) {
	return record.result !== undefined && (record.result.kind === "no-change" || record.outcome !== undefined);
}
