import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Console, Effect, FileSystem } from "effect";
import { consumerDurationEstimates, decodeConsumerTimingSnapshot } from "#ci/consumerTimings.ts";
import { balancedShards, type Shard } from "#ci/shard.ts";
import { checkBins } from "#package-check/bins.ts";
import { checkConsumer } from "#package-check/consumer.ts";
import { command, writeJson } from "#package-check/io.ts";
import { decodeVersions, type Package } from "#package-check/model.ts";
import { scenarios } from "#package-check/scenarios.ts";

export function checkConsumers(
	root: string,
	packages: readonly Package[],
	temporary: string,
	shard: Shard,
	report: string | undefined,
	timingSnapshot: string | undefined,
) {
	const timings: { name: string; durationMs: number }[] = [];
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const estimates =
			timingSnapshot === undefined
				? {}
				: consumerDurationEstimates(decodeConsumerTimingSnapshot(JSON.parse(yield* fs.readFileString(timingSnapshot))));
		const catalog = decodeVersions(yield* command(root, "pnpm", ["config", "get", "catalog", "--json"]));
		const store = (yield* command(root, "pnpm", ["store", "path", "--silent"])).trim();
		const selected =
			balancedShards(
				packages,
				shard.count,
				(pkg) => pkg.manifest.name,
				(pkg) => estimates[pkg.manifest.name] ?? 6000,
			)[shard.index - 1] ?? [];
		for (const pkg of selected) {
			const start = performance.now();
			yield* Console.log(`Checking packed ${pkg.manifest.name}`);
			const consumer = join(temporary, pkg.manifest.name.replace("/", "-"));
			yield* checkConsumer(root, pkg, packages, catalog, consumer, store);
			yield* checkBins(root, pkg, consumer);
			let index = 0;
			for (const scenario of yield* scenarios(root, pkg)) {
				yield* checkConsumer(root, pkg, packages, catalog, `${consumer}-${index}`, store, scenario);
				index += 1;
			}
			timings.push({ durationMs: Math.round(performance.now() - start), name: pkg.manifest.name });
			yield* Console.log(`Passed packed ${pkg.manifest.name} (${timings.at(-1)?.durationMs}ms)`);
		}
	}).pipe(Effect.ensuring(report === undefined ? Effect.void : writeJson(report, { shard, timings }).pipe(Effect.orDie)));
}
