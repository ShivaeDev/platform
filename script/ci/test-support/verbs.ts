import { Effect } from "effect";
import { mainShardPlan } from "#ci/mainShardPlan.ts";
import { mergeConsumerTimings } from "#ci/mergeConsumerTimings.ts";
import { mergeTestTimings } from "#ci/mergeTestTimings.ts";
import { balancedShards, parseShard } from "#ci/shard.ts";
import { consumerShardMs, jobDurations, shardTargetMs, wallTimeShardCount } from "#ci/shardCount.ts";
import { testPackages } from "#ci/testPackages.ts";
import { decodeTimingSnapshot, durationEstimates, mergeConsumerTimingReports, type TimingSnapshot } from "#ci/timings.ts";
import type { Workspace } from "./workspace.ts";
import { workspaceCoverage } from "./workspaceCoverage.ts";

export function verbs(engine: Workspace) {
	function vitest() {
		if (engine.vitest === undefined) {
			throw new Error("Declare the vitestWorkspace trait before sequencing tests");
		}
		return engine.vitest;
	}
	return {
		addExample: (name: string) => engine.workspace.example(name),
		configure: (zone: string, name: string) => engine.workspace.configured(zone, name),
		consumerBudget: consumerShardMs,
		countShards: wallTimeShardCount,
		discover: () => testPackages(engine.workspace.root).map((pkg) => pkg.name),
		mergeConsumers: (reports: readonly unknown[], targetMs: number, count = reports.length) =>
			mergeConsumerTimings(reports, { count, jobs: engine.jobs, runId: "42", sha: "main-sha", targetMs }),
		mergeReports: (reports: readonly unknown[]) => mergeConsumerTimingReports(reports, "42", "main-sha"),
		mergeTests: (reports: readonly string[], targetMs: number, count = reports.length) =>
			mergeTestTimings(reports, { count, jobs: engine.jobs, runId: "42", sha: "main-sha", targetMs }),
		parseShard,
		planMain: () => {
			if (engine.githubLayer === undefined) {
				throw new Error("Declare measuredMain before planning snapshots");
			}
			return mainShardPlan("owner/repo", engine.github).pipe(Effect.scoped, Effect.provide(engine.githubLayer));
		},
		planMeasured: (names: readonly string[], count: number, snapshot: TimingSnapshot) => {
			const estimates = durationEstimates(snapshot);
			return balancedShards(
				names,
				count,
				(name) => name,
				(name) => estimates[name] ?? 6000,
			);
		},
		planningLogs: () => engine.logs.flat().join("\n"),
		planShards: (items: readonly { name: string; seconds: number }[], count: number) =>
			balancedShards(
				items,
				count,
				(item) => item.name,
				(item) => item.seconds,
			),
		readCoverage: (file: string) => Effect.sync(() => workspaceCoverage(file)),
		readEstimates: durationEstimates,
		readJobResponse: jobDurations,
		readJobs: (name: RegExp, count: number) => jobDurations(engine.jobs, name, count),
		readSnapshot: decodeTimingSnapshot,
		readTarget: shardTargetMs,
		sequence: (count: number, index: number, reversed = false) =>
			Effect.promise(async () => {
				const fixture = vitest();
				const files = await fixture.vitest.globTestSpecifications();
				fixture.vitest.config.shard = { count, index };
				return (await fixture.sequencer.shard(reversed ? files.reverse() : files)).map((file) => fixture.sequencer.name(file));
			}),
		testNames: () =>
			Effect.promise(async () => {
				const fixture = vitest();
				return (await fixture.vitest.globTestSpecifications()).map((file) => fixture.sequencer.name(file)).sort();
			}),
		withTimings: (snapshot: TimingSnapshot) => vitest().withTimings(snapshot),
	};
}
