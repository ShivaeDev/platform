import { Result } from "effect";
import { CiFailure } from "#ci/Failure.ts";

const MAXIMUM_SHARDS = 32;
const MINIMUM_CONSUMER_SHARD_MS = 60_000;

export function wallTimeShardCount(jobDurationsMs: readonly number[], shardMs: number): Result.Result<number, CiFailure> {
	if (!Number.isFinite(shardMs) || shardMs <= 0) {
		return Result.fail(new CiFailure({ message: "Invalid shard wall time target" }));
	}
	const total = jobDurationsMs.reduce((sum, duration) => sum + duration, 0);
	return Result.succeed(Math.min(MAXIMUM_SHARDS, Math.max(1, Math.ceil(total / shardMs))));
}

export function consumerShardMs(targetMs: number, buildMs: number): number {
	return Math.max(MINIMUM_CONSUMER_SHARD_MS, targetMs - buildMs);
}

function jobRecord(job: unknown): job is { readonly conclusion?: unknown; "completed_at"?: unknown; readonly name: string; "started_at"?: unknown } {
	return typeof job === "object" && job !== null && "name" in job && typeof job.name === "string";
}

export function jobDurations(value: unknown, name: RegExp, count: number): Result.Result<number[], CiFailure> {
	if (typeof value !== "object" || value === null || !("jobs" in value) || !Array.isArray(value.jobs)) {
		return Result.fail(new CiFailure({ message: "Invalid workflow jobs response" }));
	}
	const durations: number[] = [];
	for (const job of value.jobs) {
		if (jobRecord(job) && name.test(job.name)) {
			const duration = Date.parse(String(job.completed_at)) - Date.parse(String(job.started_at));
			if (job.conclusion !== "success" || !Number.isFinite(duration) || duration <= 0) {
				return Result.fail(new CiFailure({ message: `Invalid job timing: ${job.name}` }));
			}
			durations.push(duration);
		}
	}
	if (durations.length !== count) {
		return Result.fail(new CiFailure({ message: `Job timings must cover every ${name.source} job` }));
	}
	return Result.succeed(durations);
}

export function shardTargetMs(seconds: string | undefined): Result.Result<number, CiFailure> {
	const value = Number(seconds);
	if (!Number.isSafeInteger(value) || value <= 0) {
		return Result.fail(new CiFailure({ message: "Provide a positive whole number of target seconds" }));
	}
	return Result.succeed(value * 1000);
}
