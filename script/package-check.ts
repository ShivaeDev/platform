import { resolve } from "node:path";
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { parsedArguments } from "#adapters/parsedArguments.ts";
import { parseShard } from "#ci/shard.ts";
import { prepareArchives, verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import { checkConsumers } from "#package-check/consumers.ts";
import { requireThat } from "#package-check/io.ts";

const program = Effect.gen(function* () {
	const { values } = yield* parsedArguments({
		options: {
			archives: { type: "string" },
			prepare: { type: "string" },
			report: { type: "string" },
			shard: { default: "1/1", type: "string" },
			timings: { type: "string" },
		},
	});
	yield* requireThat(
		values.prepare === undefined
			|| (values.archives === undefined && values.shard === "1/1" && values.report === undefined && values.timings === undefined),
		"--prepare cannot be combined with consumer options",
	);
	const shard = yield* Effect.fromResult(parseShard(values.shard));
	yield* requireThat(values.archives !== undefined || shard.count === 1, "Consumer shards require --archives from a shared preparation run");
	const root = process.cwd();
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-packages-" });
	const archives = resolve(values.prepare ?? values.archives ?? temporary);
	const packages = yield* workspaceArchives(root, archives);
	if (values.archives === undefined) {
		yield* prepareArchives(packages, archives);
	} else {
		yield* verifyArchives(packages, archives);
	}
	if (values.prepare === undefined) {
		yield* checkConsumers(root, packages, temporary, shard, values.report, values.timings);
	}
});
NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
