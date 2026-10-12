import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem } from "effect";
import { postgresTestEnvironment } from "#lib/postgres-test-environment.ts";
import { command, requireThat } from "#package-check/io.ts";
import { decodeVersions } from "#package-check/model.ts";
import { copyStarter, installDocumentation } from "#starter-published/copy.ts";
import { checkDocumentation, readDocumentation } from "#starter-published/documentation.ts";
import { runStarter } from "#starter-published/run.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-published-" });
	const repository = dirname((yield* command(root, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim());
	for (const workspace of [root, repository]) {
		const location = relative(workspace, temporary);
		yield* requireThat(
			location.startsWith("../") || isAbsolute(location),
			"The published check needs a temporary folder outside the workspace; set TMPDIR.",
		);
	}
	const versions = decodeVersions(yield* fs.readFileString(join(root, "examples/starter/published-versions.json")));
	const entries = yield* readDocumentation(root, versions);
	const documentation = join(temporary, "documentation");
	yield* Effect.log("Installing documented framework APIs from npm.");
	yield* installDocumentation(root, documentation, versions);
	yield* checkDocumentation(documentation, entries, versions);
	const starter = join(temporary, "starter");
	yield* copyStarter(root, starter, versions);
	yield* Effect.log("Installing the copied starter from npm.");
	yield* command(starter, "pnpm", ["install", "--registry=https://registry.npmjs.org", "--frozen-lockfile=false"]);
	const database = yield* Config.string("TEST_DATABASE_URL").pipe(
		Config.orElse(() => Config.string("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL")),
		Effect.catch(() => Effect.map(postgresTestEnvironment, (env) => env.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL)),
	);
	yield* runStarter(starter, database);
	yield* Effect.log("Published starter passed typecheck, build and real PostgreSQL/authenticated HTTP round trips.");
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
