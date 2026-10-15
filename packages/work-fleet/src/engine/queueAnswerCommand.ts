import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";

export function queueAnswerCommand(state: EngineState) {
	return Effect.fn("Fleet.queueAnswer")(function* (workId: string, text: string) {
		if (!text.trim() || text.length > 32_768) {
			return yield* new BadRequest({ message: "Supply a nonempty answer of at most 32768 characters" });
		}
		const stored = yield* state.load(workId);
		if (!["repairing", "executing"].includes(stored.value.stage)) {
			return yield* new Conflict({ message: "Decision changed" });
		}
		return yield* state.save(stored, { ...stored.value, pendingAnswers: [...(stored.value.pendingAnswers ?? []), text] });
	});
}
