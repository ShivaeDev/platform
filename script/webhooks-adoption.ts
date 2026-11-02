import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, FileSystem, Option } from "effect";
import { prepareArchives, verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import { requireThat } from "#package-check/io.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { checkWebhooks } from "#webhooks-adoption/check.ts";

const { values } = parseArgs({ options: { archives: { type: "string" } } });
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const program = Effect.gen(function* () {
	const database = yield* Config.String("PLATFORM_JOBS_TEST_DATABASE_URL").pipe(Config.option);
	if (Option.isNone(database)) {
		const ci = yield* Config.String("CI").pipe(Config.withDefault(""));
		yield* requireThat(ci === "" || ci === "false", "Webhooks adoption requires PLATFORM_JOBS_TEST_DATABASE_URL in CI.");
		yield* Effect.log("SKIP webhooks adoption: set PLATFORM_JOBS_TEST_DATABASE_URL to run against PostgreSQL.");
		return;
	}
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-webhooks-adoption-" });
	const archives = values.archives === undefined ? join(temporary, "archives") : resolve(root, values.archives);
	const packages = yield* workspaceArchives(root, archives);
	if (values.archives === undefined) {
		yield* prepareArchives(packages, archives);
	} else {
		yield* verifyArchives(packages, archives);
	}
	const tarballs = Object.fromEntries(packages.map((pkg) => [pkg.manifest.name, pkg.tarball]));
	const folder = yield* generateStarter(root, temporary, tarballs["@shivaedev/create-app"], tarballs, undefined, true);
	yield* checkWebhooks(root, join(temporary, folder), database.value);
	yield* Effect.log("Webhooks adoption passed: generated app, signed HTTP delivery, worker result and retry without a second result.");
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
