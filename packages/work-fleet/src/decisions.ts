import { Effect, Schema } from "effect";
import { Batch, type Decision, Policy, type State, type Work } from "./domain.ts";
import { normalizeBatch } from "./paths.ts";
import { failure } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { putWork, question } from "./state.ts";

function validate(batch: Batch) {
	const ids = new Set(batch.works.map((work) => work.id));
	return (
		batch.works.length > 0
		&& ids.size === batch.works.length
		&& batch.works.every(
			(work) =>
				/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.exec(work.repository) !== null
				&& work.checkout.startsWith("/")
				&& work.scope.length > 0
				&& work.scope.every(
					(scope) => !(scope.path.startsWith("/") || scope.path.split("/").some((part) => part === ".." || part === "." || part === "")),
				),
		)
	);
}
export function acceptBatch(store: StoreService, input: unknown) {
	return Effect.gen(function* () {
		const decoded = yield* Schema.decodeUnknownEffect(Batch)(input).pipe(Effect.mapError(() => failure("Invalid batch contract")));
		if (!validate(decoded)) {
			return yield* Effect.fail(failure("Batch requires unique work IDs, owner/repository, absolute checkouts and nonempty relative scopes"));
		}
		const batch = yield* normalizeBatch(decoded, yield* store.location());
		yield* store.update((state) => {
			if (state.works.some((work) => work.batchId === batch.id || batch.works.some((item) => item.id === work.spec.id))) {
				return Effect.fail(failure("Batch or work ID already exists"));
			}
			const works: Work[] = batch.works.map((spec) =>
				question(
					{
						batchId: batch.id,
						feedback: "",
						merge: "none",
						observation: null,
						outcome: null,
						phase: "queued",
						publish: "none",
						question: null,
						review: null,
						spec,
						validation: null,
					},
					"Approve this work scope?",
					"Inspect the instructions, ownership scope and completion condition, then record an approve decision.",
				),
			);
			return Effect.succeed({ ...state, works: [...state.works, ...works] });
		});
	});
}
export function decide(store: StoreService, workId: string, action: Exclude<Decision["action"], "attach" | "reject-submission">, reason: string) {
	return Effect.gen(function* () {
		if (!reason.trim()) {
			return yield* Effect.fail(failure("A decision requires a reason"));
		}
		const at = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
		yield* store.update((state) => {
			const work = state.works.find((item) => item.spec.id === workId);
			if (!work || work.phase === "completed") {
				return Effect.fail(failure("Decision needs an existing unfinished work item"));
			}
			const next: State = { ...state, decisions: [...state.decisions, { action, at, id: `decision-${state.decisions.length + 1}`, reason, workId }] };
			if (action === "hold") {
				return Effect.succeed(putWork(next, { ...work, phase: "held" }));
			}
			if (action === "resume") {
				const phase = resumedPhase(state, work);
				return Effect.succeed(putWork(next, { ...work, phase, question: null }));
			}
			return Effect.succeed(next);
		});
	});
}
export function setPolicy(store: StoreService, input: unknown) {
	return Effect.gen(function* () {
		const policy = yield* Schema.decodeUnknownEffect(Policy)(input).pipe(Effect.mapError(() => failure("Invalid policy")));
		yield* store.update((state) => Effect.succeed({ ...state, policy }));
	});
}
function resumedPhase(state: State, work: Work): Work["phase"] {
	const last = state.attempts.findLast((attempt) => attempt.workId === work.spec.id);
	if (last?.status === "failed") {
		return last.role === "worker" ? "repair" : "reviewing";
	}
	if (work.review?.verdict === "repair") {
		return "repair";
	}
	if (work.outcome) {
		return work.review?.verdict === "approve" ? "delivery" : "reviewing";
	}
	return "queued";
}
