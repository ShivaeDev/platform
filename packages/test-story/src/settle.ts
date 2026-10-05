import { indentStory } from "#indentStory.ts";
import type { StoryLog } from "#storyLog.ts";

export interface SettleSpec<TReport> {
	readonly cap: number;
	readonly diagnose: () => string;
	readonly failed: () => Error | undefined;
	readonly report: () => TReport;
	readonly settled: () => boolean;
	readonly step: () => void;
}

const RECENT_LINES = 10;

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

export function unsettled(diagnosis: string, log: StoryLog): Error {
	return new Error(`${diagnosis}\nlast lines of the story:\n${indentStory(log.lines.slice(-RECENT_LINES))}`);
}
