import type { QueueOptions } from "#definition.ts";

export function maxDeferrals(options: QueueOptions | undefined): number {
	const limit = options?.maxDeferrals ?? 10;
	if (!Number.isSafeInteger(limit) || limit < 0) {
		throw new RangeError("maxDeferrals must be a nonnegative safe integer");
	}
	return limit;
}

export function nativeQueueOptions(options: QueueOptions | undefined) {
	const { maxDeferrals: _limit, ...native } = options ?? {};
	return Object.freeze(native);
}
