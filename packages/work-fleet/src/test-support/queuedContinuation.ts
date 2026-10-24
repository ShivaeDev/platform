import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function queuedContinuation(controls: {
	readonly checksBlocked: () => boolean;
	readonly launch: () => { model: string };
	readonly now: () => number;
	readonly reject: () => boolean;
}) {
	return (): EngineOptions => ({
		checksQuery: (result) => Effect.succeed({ evidence: ["Required validation"], head: result.head, passed: !controls.checksBlocked() }),
		launch: controls.launch(),
		now: () => controls.now(),
		resultQuery: (_board, observation) => Effect.succeed({ evidence: [observation.output], head: "current-main", kind: "no-change" }),
		submissionFailure: () =>
			controls.reject() ? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" }) : undefined,
	});
}
