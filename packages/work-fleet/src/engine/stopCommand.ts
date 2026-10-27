import { Effect } from "effect";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseReceipts } from "#engine/releaseReceipts.ts";
import { executing } from "#model.ts";

export const STOP_REASON = "Work stopped by orchestrator";

export function stopCommand(state: EngineState) {
	return Effect.fn("Fleet.stop")(function* (workId: string) {
		let stored = yield* state.load(workId);
		if (!executing(stored.value)) {
			return yield* new Forbidden({ message: "Stop requires running work" });
		}
		stored = yield* state.decision(
			{ ...stored, value: { ...stored.value, releaseReason: STOP_REASON } },
			"fleet-invalid",
			STOP_REASON,
			"Release Fleet ownership after interrupting the running turn",
		);
		for (const attempt of stored.value.attempts) {
			if (["submitting", "accepted", "running"].includes(attempt.status)) {
				for (const receipt of yield* releaseReceipts(state, attempt)) {
					yield* state.sessions.interrupt(receipt);
				}
			}
		}
		return stored;
	});
}
