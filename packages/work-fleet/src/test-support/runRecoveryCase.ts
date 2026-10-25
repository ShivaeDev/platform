import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { enterRecoveryCase } from "#test/enterRecoveryCase.ts";
import { answerReport } from "#test/report.ts";

export function runRecoveryCase(state: EngineStory, tell: (line: string) => void) {
	let entered: Effect.Success<ReturnType<typeof enterRecoveryCase>> | undefined;
	let responseId: string | undefined;
	function stopped() {
		if (entered === undefined) {
			throw new Error("Enter the decision before recovering it");
		}
		return entered;
	}
	function response() {
		if (responseId === undefined) {
			throw new Error("Answer the decision before repeating its receipt");
		}
		return responseId;
	}
	function observe(record: FleetRecord) {
		state.lastRecord = record;
		tell(`Fleet records ${record.step}`);
		return record;
	}
	function answer(action: "retry" | "release") {
		const { decision } = stopped();
		if (decision.published === undefined) {
			throw new Error("Missing published decision");
		}
		responseId = answerReport(state.root, decision.published, action);
		tell(`answer ${decision.code}: ${action}`);
		return running(state).fixture.restart(Fleet.pipe(Effect.flatMap((fleet) => fleet.resolve("one", decision.id, response()))));
	}
	return {
		answerDecision: (action: "retry" | "release") => answer(action).pipe(Effect.map(({ value }) => observe(value))),
		currentRecovery: () =>
			running(state)
				.fleet.get("one")
				.pipe(Effect.map(({ value }) => value)),
		dispatchRecovered: () =>
			running(state).fixture.restart(
				Fleet.pipe(
					Effect.flatMap((fleet) => fleet.dispatch("one")),
					Effect.map(({ value }) => observe(value)),
				),
			),
		enterDecision: () =>
			enterRecoveryCase(state).pipe(
				Effect.tap((entry) =>
					Effect.sync(() => {
						entered = entry;
						tell(`enter ${entry.decision.code}`);
					}),
				),
			),
		reconcileRecovered: () =>
			running(state).fixture.restart(
				Fleet.pipe(
					Effect.flatMap((fleet) => fleet.reconcile("one")),
					Effect.map(({ value }) => observe(value)),
				),
			),
		recoveryEvidence: () =>
			Effect.gen(function* () {
				const { scenario, submissionCalls } = stopped();
				const { fleet, fixture } = running(state);
				return {
					observations: scenario.observe?.(),
					records: (yield* fleet.list()).map(({ value }) => value),
					reservations: yield* fixture.foreignReservations(),
					reviews: [...fixture.reviews],
					submissionCalls,
					submissions: [...fixture.settings],
				};
			}),
		rejectRetry: () => answer("retry").pipe(Effect.flip),
		repeatAnswer: () => {
			const { decision } = stopped();
			const receipt = response();
			tell("restart and replay the exact answer receipt");
			return running(state).fixture.restart(
				Fleet.pipe(
					Effect.flatMap((fleet) => fleet.resolve("one", decision.id, receipt)),
					Effect.map(({ value }) => value),
				),
			);
		},
		restartDecision: () => {
			stopped();
			tell("restart Fleet from PostgreSQL");
			return running(state).fixture.restart(
				Fleet.pipe(
					Effect.flatMap((fleet) => fleet.get("one")),
					Effect.map(({ value }) => observe(value)),
				),
			);
		},
		restoreRecovery: () => {
			const { scenario, context } = stopped();
			if (scenario.restore === undefined) {
				throw new Error("This recovery row has no integration to restore");
			}
			tell("restore the recovery integration");
			return scenario.restore(context).pipe(Effect.provideService(Fleet, running(state).fleet));
		},
	};
}
