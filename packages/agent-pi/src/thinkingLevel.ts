import { Effect } from "effect";
import { rejected } from "#failure.ts";

export const piEfforts = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type PiThinkingLevel = (typeof piEfforts)[number];

export function thinkingLevel(effort: string | undefined) {
	if (effort === undefined) {
		return Effect.succeed(undefined);
	}
	const level = piEfforts.find((candidate) => candidate === effort);
	return level === undefined
		? Effect.fail(rejected(`effort ${effort} is not a thinking level Pi offers; choose one of ${piEfforts.join(", ")}`))
		: Effect.succeed(level);
}
