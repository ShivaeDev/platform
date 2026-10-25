import { statfs } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Console, Effect, FileSystem } from "effect";
import { balancedShards, type Shard } from "#ci/shard.ts";
import { decodeTimingSnapshot, durationEstimates } from "#ci/timings.ts";
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
			timingSnapshot === undefined ? {} : durationEstimates(decodeTimingSnapshot(JSON.parse(yield* fs.readFileString(timingSnapshot))));
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
			yield* Effect.gen(function* () {
				const start = performance.now();
				yield* Console.log(`Checking packed ${pkg.manifest.name}`);
				const prefix = `${pkg.manifest.name.replace("/", "-")}-`;
				yield* Effect.gen(function* () {
					const consumer = yield* fs.makeTempDirectoryScoped({ directory: temporary, prefix });
					yield* checkConsumer(root, pkg, packages, catalog, consumer, store);
					yield* checkBins(root, pkg, consumer, packages);
				}).pipe(Effect.scoped);
				for (const [index, scenario] of (yield* scenarios(root, pkg)).entries()) {
					yield* Effect.gen(function* () {
						const consumer = yield* fs.makeTempDirectoryScoped({ directory: temporary, prefix: `${prefix}${index}-` });
						yield* checkConsumer(root, pkg, packages, catalog, consumer, store, scenario);
					}).pipe(Effect.scoped);
				}
				timings.push({ durationMs: Math.round(performance.now() - start), name: pkg.manifest.name });
				yield* Console.log(`Passed packed ${pkg.manifest.name} (${timings.at(-1)?.durationMs}ms)`);
			}).pipe(Effect.ensuring(logFreeDisk(temporary, pkg.manifest.name)));
		}
	}).pipe(Effect.ensuring(report === undefined ? Effect.void : writeJson(report, { shard, timings }).pipe(Effect.orDie)));
}

const logFreeDisk = Effect.fn("Packed.logFreeDisk")(function* (temporary: string, name: string) {
	const { bavail, bsize } = yield* Effect.promise(() => statfs(temporary));
	yield* Console.log(`Free disk after packed ${name}: ${Math.floor((bavail * bsize) / 1024 ** 2)} MiB`);
});
