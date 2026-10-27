import { Effect, Schedule } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseReceipts } from "#engine/releaseReceipts.ts";
import type { Attempt } from "#model.ts";

export const interruptWork = Effect.fn("Fleet.interruptWork")(function* (state: EngineState, attempt: Attempt) {
	const interrupted = yield* Effect.gen(function* () {
		const receipts = yield* releaseReceipts(state, attempt);
		for (const receipt of receipts) {
			yield* state.sessions.interrupt(receipt);
		}
		for (const receipt of receipts) {
			yield* state.sessions.observe(receipt).pipe(
				Effect.repeat({
					schedule: Schedule.spaced("100 millis"),
					until: (observation) => !["accepted", "running"].includes(observation.execution),
				}),
			);
		}
		return receipts;
	}).pipe(Effect.timeout("5 seconds"), Effect.result);
	return {
		...(interrupted._tag === "Success"
			? { status: interrupted.success.length === 0 ? ("failed" as const) : ("interrupted" as const), terminalReceipts: interrupted.success }
			: { abandoned: { at: state.policy.now(), interruptError: interrupted.failure.message }, status: "failed" as const }),
		output: undefined,
		sessionUnusable: true,
	};
});
