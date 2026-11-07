import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";
import { verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import { command, requireThat } from "#package-check/io.ts";
import { decodeVersions } from "#package-check/model.ts";
import { checkStarters } from "#starter-published/check.ts";
import { checkDocumentation, readDocumentation } from "#starter-published/documentation.ts";
import { installDocumentation } from "#starter-published/installDocumentation.ts";

const { values } = parseArgs({
	options: {
		archives: { type: "string" },
		"create-app-version": { type: "string" },
		registry: { default: false, type: "boolean" },
		variant: { type: "string" },
	},
});
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	yield* requireThat(!values.registry || values.archives === undefined, "Registry mode cannot use workspace archives.");
	yield* requireThat(values.registry || values["create-app-version"] === undefined, "A create-app version requires registry mode.");
	yield* requireThat(
		values.variant === undefined || values.variant === "full" || values.variant === "minimal",
		"The starter variant must be full or minimal.",
	);
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-published-" });
	const repository = dirname((yield* command(root, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim());
	for (const workspace of [root, repository]) {
		const location = relative(workspace, temporary);
		yield* requireThat(
			location.startsWith("../") || isAbsolute(location),
			"The published check needs a temporary folder outside the workspace; set TMPDIR.",
		);
	}
	const versions = { ...decodeVersions(yield* fs.readFileString(join(root, "examples/starter/published-versions.json"))) };
	let tarballs: Readonly<Record<string, string>> = {};
	if (values.archives !== undefined) {
		const archives = resolve(root, values.archives);
		const packages = yield* workspaceArchives(root, archives);
		yield* verifyArchives(packages, archives);
		tarballs = Object.fromEntries(packages.map((pkg) => [pkg.manifest.name, pkg.tarball]));
		for (const pkg of packages) {
			if (pkg.manifest.name in versions) {
				versions[pkg.manifest.name] = pkg.manifest.version;
			}
		}
	}
	const source = values.archives === undefined ? "pinned npm releases" : "packed workspace versions";
	const entries = yield* readDocumentation(root, versions);
	const documentation = join(temporary, "documentation");
	yield* Effect.log(`Installing documented framework APIs from ${source}.`);
	yield* installDocumentation(root, documentation, versions, tarballs);
	yield* checkDocumentation(documentation, entries, versions, source);
	const { TEST_DATABASE_URL: database } = yield* postgresTestEnvironment;
	const registryVersion = values.registry ? (values["create-app-version"] ?? "latest") : undefined;
	const variants = values.variant === undefined ? [false, true] : [values.variant === "minimal"];
	yield* checkStarters(root, temporary, tarballs, database, registryVersion, variants);
	yield* Effect.log("Published starter passed quality lint, typecheck, build and real PostgreSQL/authenticated HTTP round trips.");
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
