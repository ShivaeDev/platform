import { Effect } from "effect";
import type { AgentResult, Attempt, ProviderRef, State, Work } from "./domain.ts";
import { failure } from "./ports.ts";
import { putAttempt, putWork, question } from "./state.ts";
export function validateIdentity(state: State, attempt: Attempt, ref: ProviderRef) {
	if (attempt.ref && (attempt.ref.sessionId !== ref.sessionId || (attempt.ref.turnId !== null && attempt.ref.turnId !== ref.turnId))) {
		return Effect.fail(failure("Provider changed a durable attempt identity"));
	}
	if (
		attempt.role === "reviewer"
		&& state.attempts.some((other) => other.workId === attempt.workId && other.role === "worker" && other.ref?.sessionId === ref.sessionId)
	) {
		return Effect.fail(failure("Independent review requires a separate provider session"));
	}
	return Effect.void;
}
function reviewPhase(work: Work, verdict: "approve" | "repair"): Work["phase"] {
	if (work.phase === "held") {
		return "held";
	}
	return verdict === "approve" ? "delivery" : "repair";
}
export function completeAttempt(state: State, attempt: Attempt, work: Work, ref: ProviderRef, result: AgentResult) {
	const next = putAttempt(state, { ...attempt, ref, result, status: "completed" });
	if (attempt.role === "worker" && result.kind === "outcome") {
		return putWork(next, {
			...work,
			merge: "none",
			outcome: result.outcome,
			phase: work.phase === "held" ? "held" : "reviewing",
			publish: "none",
			question: null,
			review: null,
			validation: null,
		});
	}
	if (attempt.role === "reviewer" && result.kind === "review" && result.revision === attempt.revision && result.revision === work.outcome?.revision) {
		return putWork(next, {
			...work,
			feedback: result.summary,
			phase: reviewPhase(work, result.verdict),
			question: null,
			review: { attemptId: attempt.id, ...result },
		});
	}
	return putWork(
		next,
		question(
			{ ...work, phase: "held" },
			"Can the invalid execution result be corrected?",
			"The role or reviewed revision did not match the durable attempt.",
		),
	);
}
