const MAXIMUM_SHARDS = 32;
const MINIMUM_CONSUMER_SHARD_MS = 60_000;

export function wallTimeShardCount(jobDurationsMs: readonly number[], shardMs: number): number {
	if (!Number.isFinite(shardMs) || shardMs <= 0) {
		throw new Error("Invalid shard wall time target");
	}
	const total = jobDurationsMs.reduce((sum, duration) => sum + duration, 0);
	return Math.min(MAXIMUM_SHARDS, Math.max(1, Math.ceil(total / shardMs)));
}

export function consumerShardMs(targetMs: number, buildMs: number): number {
	return Math.max(MINIMUM_CONSUMER_SHARD_MS, targetMs - buildMs);
}

export function jobDurations(value: unknown, name: RegExp, count: number): number[] {
	if (typeof value !== "object" || value === null || !("jobs" in value) || !Array.isArray(value.jobs)) {
		throw new Error("Invalid workflow jobs response");
	}
	const durations = value.jobs
		.filter((job: { name?: unknown }) => typeof job.name === "string" && name.test(job.name))
		.map((job: { conclusion?: unknown; "completed_at"?: unknown; name: string; "started_at"?: unknown }) => {
			const duration = Date.parse(String(job.completed_at)) - Date.parse(String(job.started_at));
			if (job.conclusion !== "success" || !Number.isFinite(duration) || duration <= 0) {
				throw new Error(`Invalid job timing: ${job.name}`);
			}
			return duration;
		});
	if (durations.length !== count) {
		throw new Error(`Job timings must cover every ${name.source} job`);
	}
	return durations;
}

export function shardTargetMs(seconds: string | undefined): number {
	const value = Number(seconds);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error("Provide a positive whole number of target seconds");
	}
	return value * 1000;
}
