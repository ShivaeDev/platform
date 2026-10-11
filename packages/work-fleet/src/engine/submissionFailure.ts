import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { SessionFailure } from "#session/schema.ts";

export function submissionFailure({ load, save, decision }: EngineState, workId: string, operationId: string) {
	return Effect.fn("Fleet.submissionFailure")(function* (error: SessionFailure) {
		if (error.reason !== "rejected" && error.reason !== "unavailable") {
			return;
		}
		const current = yield* load(workId);
		const attempts = current.value.attempts.map((item) => (item.operationId === operationId ? { ...item, status: "failed" as const } : item));
		yield* decision(yield* save(current, { ...current.value, attempts }), error.message, "Restore provider access and retry this approved work");
	});
}
