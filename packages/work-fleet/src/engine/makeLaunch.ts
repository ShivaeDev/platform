import { Effect } from "effect";
import { admit } from "#admit.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { pathsOverlap } from "#storage/admission.ts";
import type { Versioned } from "#storage/model.ts";
export function makeLaunch({ store, board, policy, sessions, load, save, decision }: EngineState) {
	return Effect.fn("Fleet.launch")(function* (stored: Versioned<FleetRecord>, role: "worker" | "repair", prompt: string) {
		const work = yield* board.get(stored.value.workId);
		if (work.revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed after preparation", "Approve and prepare the current scope");
		}
		const quota = yield* policy.refreshQuota === undefined ? Effect.succeed(policy.quota) : policy.refreshQuota();
		yield* admit(
			work,
			(yield* store.list()).map(({ value }) => value),
			{ ...policy, quota },
		);
		const foreign = yield* store.foreignReservations();
		const overlap = foreign.find((entry) =>
			entry.paths.some((path) => stored.value.preparation.ownedPaths.some((owned) => pathsOverlap(path, owned))),
		);
		if (overlap !== undefined) {
			return yield* decision(stored, `Native ownership overlaps ${overlap.owner}`, "Wait for that owner to release this scope");
		}
		const attempt: Attempt = { operationId: policy.operationId(), role, status: "submitting", submittedAt: policy.now() };
		const intent = yield* save(
			stored,
			{ ...stored.value, attempts: [...stored.value.attempts, attempt], blocker: undefined, stage: "executing" },
			{ quota, role },
		);
		const original = stored.value.attempts.find((previous) => previous.role === "worker" && previous.receipt !== undefined)?.receipt;
		const submitted =
			role === "repair" && original !== undefined
				? sessions.continue({ operationId: attempt.operationId, prompt, sessionId: original.sessionId })
				: sessions.start({ cwd: stored.value.cwd, operationId: attempt.operationId, prompt });
		yield* submitted.pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(intent.value.workId);
					if (error.reason === "rejected" || error.reason === "unavailable") {
						const attempts = current.value.attempts.map((item) =>
							item.operationId === attempt.operationId ? { ...item, status: "failed" as const } : item,
						);
						yield* decision(
							yield* save(current, { ...current.value, attempts }),
							error.message,
							"Restore provider access and retry this approved work",
						);
					}
				}),
			),
		);
		return yield* load(stored.value.workId);
	});
}
