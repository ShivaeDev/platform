import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem } from "effect";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";
import { command, requireThat } from "#package-check/io.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { runStarter } from "#starter-published/run.ts";
import { workspaceDocumentation } from "#starter-published/workspaceDocumentation.ts";

const { values } = parseArgs({
	options: { archives: { type: "string" }, "create-app-version": { type: "string" }, registry: { default: false, type: "boolean" } },
});
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	yield* requireThat(!values.registry || values.archives === undefined, "Registry mode cannot use workspace archives.");
	yield* requireThat(values.registry || values["create-app-version"] === undefined, "A create-app version requires registry mode.");
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-published-" });
	const repository = dirname((yield* command(root, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim());
	for (const workspace of [root, repository]) {
		const location = relative(workspace, temporary);
		yield* requireThat(
			location.startsWith("../") || isAbsolute(location),
			"The published check needs a temporary folder outside the workspace; set TMPDIR.",
		);
	}
	const tarballs = yield* workspaceDocumentation(root, temporary, { archives: values.archives, registry: values.registry });
	const starter = join(temporary, "starter");
	yield* generateStarter(
		root,
		temporary,
		tarballs["@shivaedev/create-app"],
		tarballs,
		values.registry ? (values["create-app-version"] ?? "latest") : undefined,
	);
	const database = yield* Config.String("TEST_DATABASE_URL").pipe(
		Config.orElse(() => Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL")),
		Effect.catch(() => Effect.map(postgresTestEnvironment, (env) => env.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL)),
	);
	yield* runStarter(starter, database);
	yield* Effect.log("Published starter passed quality lint, typecheck, build and real PostgreSQL/authenticated HTTP round trips.");
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
