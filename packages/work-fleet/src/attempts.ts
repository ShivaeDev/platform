import { Effect, Schema } from "effect";
import { AgentResult, type State } from "./domain.ts";
import { completeAttempt, validateIdentity } from "./observationResult.ts";
import { type Agent, failure, type Observation } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { activeAttempt, putAttempt, putWork, question } from "./state.ts";
export function applyObservation(store: StoreService, id: string, observation: Observation) {
	return store.update((state) =>
		Effect.gen(function* () {
			const attempt = state.attempts.find((item) => item.id === id);
			if (!attempt) {
				return yield* Effect.fail(failure("Unknown attempt"));
			}
			const work = state.works.find((item) => item.spec.id === attempt.workId);
			if (!work) {
				return yield* Effect.fail(failure("Unknown work"));
			}
			if (observation.status === "unknown") {
				return putWork(
					putAttempt(state, { ...attempt, status: "uncertain" }),
					question(work, "Can the provider execution be located?", observation.message),
				);
			}
			const ref = observation.ref;
			yield* validateIdentity(state, attempt, ref);
			if (observation.status === "pending") {
				return putWork(putAttempt(state, { ...attempt, ref, status: "running" }), { ...work, question: null });
			}
			if (observation.status === "failed") {
				return putWork(
					putAttempt(state, { ...attempt, ref, status: "failed" }),
					question({ ...work, phase: "held" }, "Should this failed execution be continued?", observation.message),
				);
			}
			const result = yield* Schema.decodeUnknownEffect(AgentResult)(observation.result).pipe(Effect.mapError(() => failure("Invalid agent result")));
			return completeAttempt(state, attempt, work, ref, result);
		}),
	);
}
export function observeAttempts(store: StoreService, agent: typeof Agent.Service) {
	return Effect.gen(function* () {
		const state = yield* store.read();
		for (const attempt of state.attempts.filter((item) => activeAttempt(item) && item.status !== "prepared")) {
			const work = state.works.find((item) => item.spec.id === attempt.workId);
			if (!work) {
				continue;
			}
			yield* agent.observe({ attempt, outcome: work.outcome, work: work.spec }).pipe(
				Effect.flatMap((observation) => applyObservation(store, attempt.id, observation)),
				Effect.catch((error) =>
					store.update((current) => Effect.succeed(putWork(current, question(work, "Can this execution be observed?", error.message)))),
				),
			);
		}
	});
}
export function hasExecution(state: State, workId: string) {
	return state.attempts.some((attempt) => attempt.workId === workId && activeAttempt(attempt));
}
