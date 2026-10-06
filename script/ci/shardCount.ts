import { balancedShards } from "./shard.ts";
import type { Timing, TimingSnapshot } from "./timings.ts";

export function measuredShardCount(timings: readonly Timing[]): number {
	if (timings.length === 0) {
		return 8;
	}
	const limit = Math.min(32, timings.length);
	const budget = timings.reduce((maximum, item) => Math.max(maximum, item.durationMs), 30_000);
	for (let count = 1; count <= limit; count += 1) {
		const groups = balancedShards(
			timings,
			count,
			(item) => item.name,
			(item) => item.durationMs,
		);
		if (groups.every((group) => group.reduce((total, item) => total + item.durationMs, 0) <= budget)) {
			return count;
		}
	}
	return limit;
}

export function sizeSnapshot(snapshot: TimingSnapshot): TimingSnapshot {
	return { ...snapshot, shardCount: measuredShardCount(snapshot.timings) };
}
