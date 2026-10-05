import { Effect } from "effect";
import { unsettled } from "#settle.ts";
import type { StoryLog } from "#storyLog.ts";

export interface EffectSettleSpec<TReport, E, R> {
	readonly cap: number;
	readonly diagnose: Effect.Effect<string, E, R>;
	readonly failed: Effect.Effect<Error | undefined, E, R>;
	readonly report: Effect.Effect<TReport, E, R>;
	readonly settled: Effect.Effect<boolean, E, R>;
	readonly step: Effect.Effect<void, E, R>;
}

export const settleEffect = Effect.fnUntraced(function* <TReport, E, R>(log: StoryLog, spec: EffectSettleSpec<TReport, E, R>) {
	for (let steps = 0; ; steps += 1) {
		const failure = yield* spec.failed;
		if (failure !== undefined) {
			return yield* Effect.die(failure);
		}
		if (yield* spec.settled) {
			return yield* spec.report;
		}
		if (steps >= spec.cap) {
			return yield* Effect.die(unsettled(yield* spec.diagnose, log));
		}
		yield* spec.step;
	}
});
