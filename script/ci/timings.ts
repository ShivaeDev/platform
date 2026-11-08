import { Effect, FileSystem, Result, Schema } from "effect";
import { CiFailure } from "#ci/Failure.ts";

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

function failure(message: string) {
	return Result.fail(new CiFailure({ message }));
}

function timings(value: unknown): Result.Result<Timing[], CiFailure> {
	if (!Array.isArray(value)) {
		return failure("Work timings must be an array");
	}
	const names = new Set<string>();
	const items: readonly unknown[] = value;
	const decoded: Timing[] = [];
	for (const item of items) {
		if (
			!record(item)
			|| typeof item.name !== "string"
			|| item.name === ""
			|| typeof item.durationMs !== "number"
			|| !Number.isFinite(item.durationMs)
			|| item.durationMs <= 0
		) {
			return failure("Invalid work timing");
		}
		if (names.has(item.name)) {
			return failure(`Duplicate work timing: ${item.name}`);
		}
		names.add(item.name);
		decoded.push({ durationMs: item.durationMs, name: item.name });
	}
	return Result.succeed(decoded);
}

export function decodeTimingSnapshot(value: unknown): Result.Result<TimingSnapshot, CiFailure> {
	if (!record(value) || typeof value.runId !== "string" || typeof value.sha !== "string") {
		return failure("Invalid work timing snapshot");
	}
	if (
		value.shardCount !== undefined
		&& (typeof value.shardCount !== "number" || !Number.isSafeInteger(value.shardCount) || value.shardCount < 1 || value.shardCount > 32)
	) {
		return failure("Invalid shard count");
	}
	const { runId, sha, shardCount } = value;
	return Result.map(timings(value.timings), (decoded) => ({
		runId,
		sha,
		timings: decoded,
		...(shardCount === undefined ? {} : { shardCount }),
	}));
}

export const readTimingSnapshot = Effect.fn("CI.readTimingSnapshot")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* Effect.fromResult(
		decodeTimingSnapshot(yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(yield* fs.readFileString(path))),
	);
});

export function mergeConsumerTimingReports(reports: readonly unknown[], runId: string, sha: string): Result.Result<TimingSnapshot, CiFailure> {
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
			return failure("Work timing reports must cover every shard exactly once");
		}
		indices.add(report.shard.index);
		const decoded = timings(report.timings);
		if (Result.isFailure(decoded)) {
			return Result.fail(decoded.failure);
		}
		combined.push(...decoded.success);
	}
	if (reports.length === 0 || combined.length === 0) {
		return failure("Work timing reports are empty");
	}
	return decodeTimingSnapshot({ runId, sha, timings: combined.sort((a, b) => a.name.localeCompare(b.name, "en")) });
}

export function durationEstimates(snapshot: TimingSnapshot): Readonly<Record<string, number>> {
	return Object.fromEntries(snapshot.timings.map((item) => [item.name, item.durationMs]));
}

const XML_ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&apos;": "'", "&gt;": ">", "&lt;": "<", "&quot;": '"' };

function xmlAttributes(text: string): Record<string, string> {
	return Object.fromEntries(
		[...text.matchAll(/(?<key>\w+)="(?<value>[^"]*)"/gu)].map((match) => [
			match.groups?.key,
			(match.groups?.value ?? "").replace(/&(?:amp|apos|gt|lt|quot);/gu, (entity) => XML_ENTITIES[entity] ?? entity),
		]),
	);
}

export function decodeJunitTimingReport(report: string): Result.Result<Timing[], CiFailure> {
	const suites = [...report.matchAll(/<testsuite\s(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/testsuite>/gu)];
	if (suites.length === 0) {
		return failure("Invalid test timing report");
	}
	const decoded: Timing[] = [];
	for (const suite of suites) {
		const attributes = xmlAttributes(suite.groups?.attributes ?? "");
		const testcase = /<testcase\s(?<attributes>[^>]*)>/u.exec(suite.groups?.body ?? "");
		const classname = xmlAttributes(testcase?.groups?.attributes ?? "").classname ?? "";
		const identity = /^\|(?<project>[^|]+)\| (?<path>.+)$/u.exec(classname);
		const durationMs = Number(attributes.time) * 1000;
		if (identity === null || attributes.time === undefined || attributes.time === "" || !Number.isFinite(durationMs) || durationMs < 0) {
			return failure("Invalid test timing");
		}
		decoded.push({ durationMs: Math.max(1, durationMs), name: `${identity.groups?.project}:${identity.groups?.path}` });
	}
	return Result.succeed(decoded);
}
