export interface ConsumerTiming {
	readonly durationMs: number;
	readonly name: string;
}

export interface ConsumerTimingSnapshot {
	readonly runId: string;
	readonly sha: string;
	readonly timings: readonly ConsumerTiming[];
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timings(value: unknown): ConsumerTiming[] {
	if (!Array.isArray(value)) {
		throw new Error("Consumer timings must be an array");
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
			throw new Error("Invalid consumer timing");
		}
		if (names.has(item.name)) {
			throw new Error(`Duplicate consumer timing: ${item.name}`);
		}
		names.add(item.name);
		return { durationMs: item.durationMs, name: item.name };
	});
}

export function decodeConsumerTimingSnapshot(value: unknown): ConsumerTimingSnapshot {
	if (!record(value) || typeof value.runId !== "string" || typeof value.sha !== "string") {
		throw new Error("Invalid consumer timing snapshot");
	}
	return { runId: value.runId, sha: value.sha, timings: timings(value.timings) };
}

export function mergeConsumerTimingReports(reports: readonly unknown[], runId: string, sha: string): ConsumerTimingSnapshot {
	const indices = new Set<number>();
	const combined: ConsumerTiming[] = [];
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
			throw new Error("Consumer timing reports must cover every shard exactly once");
		}
		indices.add(report.shard.index);
		combined.push(...timings(report.timings));
	}
	if (reports.length === 0 || combined.length === 0) {
		throw new Error("Consumer timing reports are empty");
	}
	return decodeConsumerTimingSnapshot({ runId, sha, timings: combined.sort((a, b) => a.name.localeCompare(b.name, "en")) });
}

export function consumerDurationEstimates(snapshot: ConsumerTimingSnapshot): Readonly<Record<string, number>> {
	return Object.fromEntries(snapshot.timings.map((item) => [item.name, item.durationMs]));
}
