import { Effect } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { allAttempts, executing } from "#model.ts";

export function continueCommand(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.continue")(function* (workId: string, message: string) {
		let stored = yield* state.load(workId);
		if (!message.trim()) {
			return yield* Effect.fail(new BadRequest({ message: "Continuation needs a message" }));
		}
		if (!["needs-human", "completed"].includes(stored.value.stage) || executing(stored.value)) {
			return yield* Effect.fail(new Forbidden({ message: "Continue requires terminal needs-human or completed work" }));
		}
		const latest = stored.value.attempts.findLast((attempt) => attempt.role !== "reviewer");
		const sessionId = latest?.receipt?.sessionId ?? latest?.sessionId;
		const worker = allAttempts(stored.value).findLast((attempt) => attempt.role !== "reviewer" && attempt.receipt?.sessionId === sessionId);
		if (worker?.receipt === undefined) {
			return yield* Effect.fail(new Forbidden({ message: "Continue requires an existing worker receipt" }));
		}
		const observation = yield* state.sessions.observe(worker.receipt);
		if (["accepted", "running"].includes(observation.execution)) {
			return yield* Effect.fail(new Forbidden({ message: "The existing worker turn is still running" }));
		}
		stored = yield* ensurePublication(state)(stored);
		const prompt = [stored.value.pendingContinuation, message].filter(Boolean).join("\n\n");
		return yield* launch(stored, "repair", prompt).pipe(
			Effect.catchTag("StorageCapacity", (error) =>
				error.kind === "execution"
					? state.save(stored, {
							...stored.value,
							attentionOwner: "automation",
							blocker: `Continuation queued; ${failureMessage(error)}`,
							pendingContinuation: prompt,
						})
					: Effect.fail(error),
			),
		);
	});
}
