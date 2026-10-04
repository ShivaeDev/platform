import { Effect, Schema } from "effect";
import { type Attempt, type Decision, ProviderRef, type State, type Work } from "./domain.ts";
import { failure } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { putAttempt, putWork } from "./state.ts";
export function recoverAttempt(store: StoreService, attemptId: string, reference: ProviderRef | null, reason: string) {
	return Effect.gen(function* () {
		if (!reason.trim()) {
			return yield* Effect.fail(failure("Recovery requires a concrete reason"));
		}
		const ref =
			reference === null
				? null
				: yield* Schema.decodeUnknownEffect(ProviderRef)(reference).pipe(Effect.mapError(() => failure("Invalid provider reference")));
		const at = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
		yield* store.update((state) => {
			const attempt = state.attempts.find((item) => item.id === attemptId);
			const work = state.works.find((item) => item.spec.id === attempt?.workId);
			if (!(attempt && work && ["uncertain", "submitting"].includes(attempt.status))) {
				return Effect.fail(failure("Only an uncertain submission can be resolved"));
			}
			const problem = recoveryProblem(attempt, ref);
			if (problem) {
				return Effect.fail(failure(problem));
			}
			const decision = recoveryDecision(state, attempt, ref, reason, at);
			const next = putAttempt(
				{ ...state, decisions: [...state.decisions, decision] },
				{ ...attempt, ref: ref ?? attempt.ref, status: ref ? "accepted" : "failed" },
			);
			return Effect.succeed(putWork(next, { ...work, phase: recoveryPhase(attempt, work, ref), question: null }));
		});
	});
}
function recoveryProblem(attempt: Attempt, ref: ProviderRef | null): string | undefined {
	if (!ref) {
		return attempt.ref?.turnId ? "A known provider turn cannot be declared not submitted" : undefined;
	}
	if (ref.turnId === null) {
		return "Attach the exact provider turn as well as its session";
	}
	if (!attempt.ref) {
		return;
	}
	if (ref.sessionId !== attempt.ref.sessionId) {
		return "Recovery cannot replace a known provider identity";
	}
	if (attempt.ref.turnId !== null && ref.turnId !== attempt.ref.turnId) {
		return "Recovery cannot replace a known provider identity";
	}
	return undefined;
}
function recoveryPhase(attempt: Attempt, work: Work, ref: ProviderRef | null): Work["phase"] {
	if (ref || work.phase === "held") {
		return work.phase;
	}
	return attempt.role === "worker" ? "repair" : "reviewing";
}
function recoveryDecision(state: State, attempt: Attempt, ref: ProviderRef | null, reason: string, at: number): Decision {
	return {
		action: ref ? "attach" : "reject-submission",
		at,
		attemptId: attempt.id,
		id: `decision-${state.decisions.length + 1}`,
		reason,
		workId: attempt.workId,
		...(ref ? { ref } : {}),
	};
}
