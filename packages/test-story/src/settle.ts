import { unsettled } from "#internal/unsettled.ts";
import type { StoryLog } from "#storyLog.ts";

export interface SettleSpec<TReport> {
	readonly cap: number;
	readonly diagnose: () => string;
	readonly failed: () => Error | undefined;
	readonly report: () => TReport;
	readonly settled: () => boolean;
	readonly step: () => void;
}

export function settle<TReport>(log: StoryLog, spec: SettleSpec<TReport>): TReport {
	for (let steps = 0; ; steps += 1) {
		const failure = spec.failed();
		if (failure !== undefined) {
			throw failure;
		}
		if (spec.settled()) {
			return spec.report();
		}
		if (steps >= spec.cap) {
			throw unsettled(spec.diagnose(), log);
		}
		spec.step();
	}
}
