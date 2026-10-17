import { balancedShards } from "./shard.ts";
import type { Timing, TimingSnapshot } from "./timings.ts";

const SHARD_WALL_TIME_MS = 240_000;
const MAXIMUM_SHARDS = 32;
const TEST_JOB = /^tests \(\d+\)$/u;

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

export function wallTimeShardCount(jobDurationsMs: readonly number[]): number {
	const total = jobDurationsMs.reduce((sum, duration) => sum + duration, 0);
	return Math.min(MAXIMUM_SHARDS, Math.max(1, Math.ceil(total / SHARD_WALL_TIME_MS)));
}

export function testJobDurations(value: unknown, count: number): number[] {
	if (typeof value !== "object" || value === null || !("jobs" in value) || !Array.isArray(value.jobs)) {
		throw new Error("Invalid workflow jobs response");
	}
	const durations = value.jobs
		.filter((job: { name?: unknown }) => typeof job.name === "string" && TEST_JOB.test(job.name))
		.map((job: { conclusion?: unknown; "completed_at"?: unknown; name: string; "started_at"?: unknown }) => {
			const duration = Date.parse(String(job.completed_at)) - Date.parse(String(job.started_at));
			if (job.conclusion !== "success" || !Number.isFinite(duration) || duration <= 0) {
				throw new Error(`Invalid test job timing: ${job.name}`);
			}
			return duration;
		});
	if (durations.length !== count) {
		throw new Error("Test job timings must cover every shard");
	}
	return durations;
}
