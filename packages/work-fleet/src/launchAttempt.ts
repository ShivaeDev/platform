import { Effect } from "effect";
import { applyObservation } from "./attempts.ts";
import type { Attempt, State, Work } from "./domain.ts";
import { type Agent, type FleetError, failure } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { putAttempt, putWork, question } from "./state.ts";
export function launchAttempt(store: StoreService, agent: typeof Agent.Service, attempt: Attempt) {
	return Effect.gen(function* () {
		const state = yield* store.update((current) => Effect.succeed(putAttempt(current, { ...attempt, status: "submitting" })));
		const work = state.works.find((item) => item.spec.id === attempt.workId);
		if (!work) {
			return yield* Effect.fail(failure("Unknown work"));
		}
		function acknowledge(ref: Attempt["ref"]) {
			return store
				.update((current) => {
					const latest = current.attempts.find((item) => item.id === attempt.id);
					if (!latest) {
						return Effect.fail(failure("Unknown attempt acknowledgement"));
					}
					if (latest.ref && ref && (latest.ref.sessionId !== ref.sessionId || (latest.ref.turnId !== null && latest.ref.turnId !== ref.turnId))) {
						return Effect.fail(failure("Acknowledgement changed a durable attempt identity"));
					}
					return Effect.succeed(putAttempt(current, { ...latest, ref, status: ref?.turnId ? "accepted" : "submitting" }));
				})
				.pipe(Effect.asVoid);
		}
		yield* agent.launch({ attempt, outcome: work.outcome, work: work.spec }, acknowledge).pipe(
			Effect.flatMap((observation) => applyObservation(store, attempt.id, observation)),
			Effect.catch((error) => store.update((current) => Effect.succeed(launchFailure(current, attempt, work, error)))),
		);
	});
}
function launchFailure(current: State, attempt: Attempt, work: Work, error: FleetError): State {
	const latest = current.attempts.find((item) => item.id === attempt.id) ?? attempt;
	if (error.disposition === "human" || error.disposition === "repair") {
		return putWork(
			putAttempt(current, { ...latest, status: "failed" }),
			question({ ...work, phase: "held" }, "Can the execution precondition be resolved?", error.message),
		);
	}
	return putWork(
		putAttempt(current, { ...latest, status: "uncertain" }),
		question(work, "Was this submission accepted?", `Keep this attempt reserved and reconcile before retrying. ${error.message}`),
	);
}
