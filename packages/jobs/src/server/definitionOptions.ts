import { Effect } from "effect";
import type { QueueOptions } from "#server/queueOptions.ts";

export const DEFAULT_MAX_DEFERRALS = 10;

export function maxDeferrals(options: QueueOptions | undefined): number {
	return options?.maxDeferrals ?? DEFAULT_MAX_DEFERRALS;
}

export function validateMaxDeferrals(limit: number): Effect.Effect<void> {
	if (!Number.isSafeInteger(limit) || limit < 0) {
		return Effect.die(new RangeError("maxDeferrals must be a nonnegative safe integer"));
	}
	return Effect.void;
}

export function nativeQueueOptions(options: QueueOptions | undefined) {
	const { maxDeferrals: _limit, ...native } = options ?? {};
	return Object.freeze(native);
}
