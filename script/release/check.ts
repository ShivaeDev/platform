import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem } from "effect";
import { checkRepository } from "@shivaedev/changesets/check.ts";
import { ChangesetError } from "@shivaedev/changesets/error.ts";
import config from "#release-config";

const program = Effect.gen(function* () {
	const root = process.cwd();
	const fs = yield* FileSystem.FileSystem;
	for (const name of yield* fs.readDirectory(join(root, "packages"))) {
		const directory = join(root, "packages", name, "changes");
		if (!(yield* fs.exists(directory))) {
			continue;
		}
		for (const fragment of yield* fs.readDirectory(directory)) {
			if (fragment.endsWith(".md")) {
				return yield* new ChangesetError({
					message: `Move packages/${name}/changes/${fragment} to .changeset/<short-name>.md with package names and explicit bumps in YAML frontmatter.`,
				});
			}
		}
	}
	const reference = yield* Config.String("CHANGELOG_BASE_REF").pipe(Config.withDefault(undefined));
	yield* checkRepository(root, config, process.argv[2] ?? reference);
	yield* Console.log("Changesets and release notes are valid.");
});

NodeRuntime.runMain(
	program.pipe(
		Effect.tapError((error) => Console.error(error.message)),
		Effect.provide(NodeFileSystem.layer),
	),
	{ disableErrorReporting: true },
);
