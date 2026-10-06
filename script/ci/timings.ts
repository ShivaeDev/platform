export interface Timing {
	readonly durationMs: number;
	readonly name: string;
}

export interface TimingSnapshot {
	readonly runId: string;
	readonly sha: string;
	readonly shardCount?: number;
	readonly timings: readonly Timing[];
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timings(value: unknown): Timing[] {
	if (!Array.isArray(value)) {
		throw new Error("Work timings must be an array");
	}
	const names = new Set<string>();
	return value.map((item: unknown) => {
		if (
			!record(item)
			|| typeof item.name !== "string"
			|| item.name === ""
			|| typeof item.durationMs !== "number"
			|| !Number.isFinite(item.durationMs)
			|| item.durationMs <= 0
		) {
			throw new Error("Invalid work timing");
		}
		if (names.has(item.name)) {
			throw new Error(`Duplicate work timing: ${item.name}`);
		}
		names.add(item.name);
		return { durationMs: item.durationMs, name: item.name };
	});
}

export function decodeTimingSnapshot(value: unknown): TimingSnapshot {
	if (!record(value) || typeof value.runId !== "string" || typeof value.sha !== "string") {
		throw new Error("Invalid work timing snapshot");
	}
	if (
		value.shardCount !== undefined
		&& (typeof value.shardCount !== "number" || !Number.isSafeInteger(value.shardCount) || value.shardCount < 1 || value.shardCount > 32)
	) {
		throw new Error("Invalid shard count");
	}
	return {
		runId: value.runId,
		sha: value.sha,
		timings: timings(value.timings),
		...(value.shardCount === undefined ? {} : { shardCount: value.shardCount }),
	};
}

export function mergeConsumerTimingReports(reports: readonly unknown[], runId: string, sha: string): TimingSnapshot {
	const indices = new Set<number>();
	const combined: Timing[] = [];
	for (const report of reports) {
		if (
			!(record(report) && record(report.shard))
			|| report.shard.count !== reports.length
			|| typeof report.shard.index !== "number"
			|| !Number.isInteger(report.shard.index)
			|| report.shard.index < 1
			|| report.shard.index > reports.length
			|| indices.has(report.shard.index)
		) {
			throw new Error("Work timing reports must cover every shard exactly once");
		}
		indices.add(report.shard.index);
		combined.push(...timings(report.timings));
	}
	if (reports.length === 0 || combined.length === 0) {
		throw new Error("Work timing reports are empty");
	}
	return decodeTimingSnapshot({ runId, sha, timings: combined.sort((a, b) => a.name.localeCompare(b.name, "en")) });
}

export function durationEstimates(snapshot: TimingSnapshot): Readonly<Record<string, number>> {
	return Object.fromEntries(snapshot.timings.map((item) => [item.name, item.durationMs]));
}

export function decodeVitestTimingReport(report: string): Timing[] {
	const cache: unknown = JSON.parse(report);
	if (!record(cache) || typeof cache.version !== "string" || !Array.isArray(cache.results)) {
		throw new Error("Invalid Vitest timing report");
	}
	return cache.results.map((entry: unknown) => {
		if (
			!Array.isArray(entry)
			|| entry.length !== 2
			|| typeof entry[0] !== "string"
			|| !record(entry[1])
			|| entry[1].failed !== false
			|| typeof entry[1].duration !== "number"
			|| !Number.isFinite(entry[1].duration)
			|| entry[1].duration < 0
		) {
			throw new Error("Invalid successful test timing");
		}
		return { durationMs: Math.max(1, entry[1].duration), name: entry[0] };
	});
}
