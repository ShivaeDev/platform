import { Effect, Result } from "effect";
import { mainShardPlan } from "#ci/mainShardPlan.ts";
import { mergeConsumerTimings } from "#ci/mergeConsumerTimings.ts";
import { balancedShards } from "#ci/shard.ts";
import { consumerShardMs, jobDurations, shardTargetMs, wallTimeShardCount } from "#ci/shardCount.ts";
import { mergeTimingArtifacts } from "#ci/test-support/mergeTimingArtifacts.ts";
import type { Workspace } from "#ci/test-support/workspace.ts";
import { workspaceCoverage } from "#ci/test-support/workspaceCoverage.ts";
import { testPackages } from "#ci/testPackages.ts";
import { decodeTimingSnapshot, durationEstimates, mergeConsumerTimingReports, type TimingSnapshot } from "#ci/timings.ts";

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
		countShards: (durations: readonly number[], shardMs: number) => Result.getOrThrow(wallTimeShardCount(durations, shardMs)),
		discover: () => testPackages(engine.workspace.root).map((pkg) => pkg.name),
		mergeConsumers: (reports: readonly unknown[], targetMs: number, count = reports.length) =>
			Effect.runSync(mergeConsumerTimings(reports, { count, jobs: engine.jobs, runId: "42", sha: "main-sha", targetMs })),
		mergeReports: (reports: readonly unknown[]) => Result.getOrThrow(mergeConsumerTimingReports(reports, "42", "main-sha")),
		mergeTimingArtifacts: () => mergeTimingArtifacts(engine),
		planMain: () => {
			if (engine.githubLayer === undefined) {
				throw new Error("Declare measuredQueue before planning snapshots");
			}
			return mainShardPlan("owner/repo", engine.github).pipe(Effect.scoped, Effect.provide(engine.githubLayer));
		},
		planMeasured: (names: readonly string[], count: number, snapshot: TimingSnapshot) => {
			const estimates = durationEstimates(snapshot);
			return Result.getOrThrow(
				balancedShards(
					names,
					count,
					(name) => name,
					(name) => estimates[name] ?? 6000,
				),
			);
		},
		planningLogs: () => engine.logs.flat().join("\n"),
		readCoverage: (file: string) => Effect.sync(() => workspaceCoverage(file)),
		readEstimates: durationEstimates,
		readJobResponse: (value: unknown, name: RegExp, count: number) => Result.getOrThrow(jobDurations(value, name, count)),
		readJobs: (name: RegExp, count: number) => Result.getOrThrow(jobDurations(engine.jobs, name, count)),
		readSnapshot: (value: unknown) => Result.getOrThrow(decodeTimingSnapshot(value)),
		readTarget: (seconds: string | undefined) => Result.getOrThrow(shardTargetMs(seconds)),
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
