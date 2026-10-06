import { Effect } from "effect";
import { unsettled } from "#internal/unsettled.ts";
import type { StoryLog } from "#storyLog.ts";

export interface EffectSettleSpec<
	TReport,
	TFailedError,
	TFailedServices,
	TSettledError,
	TSettledServices,
	TStepError,
	TStepServices,
	TDiagnoseError,
	TDiagnoseServices,
	TReportError,
	TReportServices,
> {
	readonly cap: number;
	readonly diagnose: Effect.Effect<string, TDiagnoseError, TDiagnoseServices>;
	readonly failed: Effect.Effect<Error | undefined, TFailedError, TFailedServices>;
	readonly report: Effect.Effect<TReport, TReportError, TReportServices>;
	readonly settled: Effect.Effect<boolean, TSettledError, TSettledServices>;
	readonly step: Effect.Effect<void, TStepError, TStepServices>;
}

export const settleEffect = Effect.fnUntraced(function* <
	TReport,
	TFailedError,
	TFailedServices,
	TSettledError,
	TSettledServices,
	TStepError,
	TStepServices,
	TDiagnoseError,
	TDiagnoseServices,
	TReportError,
	TReportServices,
>(
	log: StoryLog,
	spec: EffectSettleSpec<
		TReport,
		TFailedError,
		TFailedServices,
		TSettledError,
		TSettledServices,
		TStepError,
		TStepServices,
		TDiagnoseError,
		TDiagnoseServices,
		TReportError,
		TReportServices
	>,
) {
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
