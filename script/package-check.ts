import { resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { parseShard } from "#ci/shard.ts";
import { prepareArchives, verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import { checkConsumers } from "#package-check/consumers.ts";
import { checkSharedPeerRegression } from "#package-check/peer-regression.ts";
import { checkMissingTargetRegression } from "#package-check/target-regression.ts";

const { values } = parseArgs({
	options: {
		archives: { type: "string" },
		prepare: { type: "string" },
		report: { type: "string" },
		shard: { default: "1/1", type: "string" },
		timings: { type: "string" },
	},
});
if (
	values.prepare !== undefined
	&& (values.archives !== undefined || values.shard !== "1/1" || values.report !== undefined || values.timings !== undefined)
) {
	throw new Error("--prepare cannot be combined with consumer options");
}
const shard = parseShard(values.shard);
if (values.archives === undefined && shard.count !== 1) {
	throw new Error("Consumer shards require --archives from a shared preparation run");
}

const program = Effect.gen(function* () {
	const root = process.cwd();
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-packages-" });
	const archives = resolve(values.prepare ?? values.archives ?? temporary);
	const packages = yield* workspaceArchives(root, archives);
	if (values.archives === undefined) {
		yield* prepareArchives(packages, archives);
		yield* checkSharedPeerRegression(packages);
		yield* checkMissingTargetRegression(packages, "./dist/error.js", "whose target ./dist/error.js is not packed");
		yield* checkMissingTargetRegression(packages, "./dist/with-heavy-lock.js", "missing manifest target ./dist/with-heavy-lock.js");
	} else {
		yield* verifyArchives(packages, archives);
	}
	if (values.prepare === undefined) {
		yield* checkConsumers(root, packages, temporary, shard, values.report, values.timings);
	}
});
NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)));
