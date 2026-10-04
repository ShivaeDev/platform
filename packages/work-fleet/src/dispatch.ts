import { Effect } from "effect";
import { hasExecution } from "./attempts.ts";
import type { Attempt, State, Work } from "./domain.ts";
import { launchAttempt } from "./launchAttempt.ts";
import type { Agent } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { activeAttempt, authorized, conflicts, lastWorker, putWork, sameCheckout, writerReserved } from "./state.ts";

function eligible(state: State, work: Work) {
	if (state.policy.stopped || !state.policy.quotaAvailable || work.phase === "held" || work.phase === "completed") {
		return false;
	}
	if (!authorized(state, work.spec.id, "approve") || hasExecution(state, work.spec.id)) {
		return false;
	}
	if (!["queued", "repair", "reviewing"].includes(work.phase)) {
		return false;
	}
	if (work.phase === "reviewing") {
		return work.outcome !== null;
	}
	return !state.works.some(
		(other) => other.spec.id !== work.spec.id && writerReserved(state, other) && (sameCheckout(work, other) || conflicts(work, other)),
	);
}
function priority(work: Work) {
	if (work.phase === "repair") {
		return 0;
	}
	return work.phase === "reviewing" ? 1 : 2;
}
function resumePrepared(store: StoreService, agent: typeof Agent.Service, initial: State) {
	return Effect.gen(function* () {
		for (const attempt of initial.attempts.filter((item) => item.status === "prepared")) {
			const work = initial.works.find((item) => item.spec.id === attempt.workId);
			const current = yield* store.read();
			const executing = current.attempts.filter((item) => activeAttempt(item) && item.status !== "prepared").length;
			if (!current.policy.stopped && current.policy.quotaAvailable && work?.phase !== "held" && executing < current.policy.capacity) {
				yield* launchAttempt(store, agent, attempt);
			}
		}
	});
}
function prepareAttempt(store: StoreService, state: State, work: Work) {
	return Effect.gen(function* () {
		const role = work.phase === "reviewing" ? "reviewer" : "worker";
		const previous = role === "worker" ? lastWorker(state, work.spec.id) : undefined;
		const attempt: Attempt = {
			createdAt: yield* Effect.clockWith((clock) => clock.currentTimeMillis),
			feedback: work.feedback,
			id: `attempt-${state.attempts.length + 1}`,
			ref: previous?.ref ? { sessionId: previous.ref.sessionId, turnId: null } : null,
			result: null,
			revision: work.outcome?.revision ?? null,
			role,
			status: "prepared",
			workId: work.spec.id,
		};
		yield* store.update((current) =>
			Effect.succeed(
				putWork(
					{ ...current, attempts: [...current.attempts, attempt] },
					{ ...work, phase: role === "worker" ? "working" : "reviewing", question: null },
				),
			),
		);
		return attempt;
	});
}
export function dispatch(store: StoreService, agent: typeof Agent.Service) {
	return Effect.gen(function* () {
		const initial = yield* store.read();
		yield* resumePrepared(store, agent, initial);
		for (const candidate of [...initial.works].sort((a, b) => priority(a) - priority(b))) {
			const state = yield* store.read();
			const work = state.works.find((item) => item.spec.id === candidate.spec.id);
			if (!(work && eligible(state, work))) {
				continue;
			}
			if (state.attempts.filter(activeAttempt).length >= state.policy.capacity || state.attempts.length >= state.policy.maxAttempts) {
				break;
			}
			const attempt = yield* prepareAttempt(store, state, work);
			yield* launchAttempt(store, agent, attempt);
		}
	});
}
