import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { applyRelease } from "@shivaedev/releases/applyRelease.ts";
import { git } from "#release/test-support/git.ts";
import { repository } from "#release/test-support/repository.ts";
import config from "#release-config";

export const collectedBehindMain = repository.trait(
	"pending",
	"main merges a breaking change after the release collects its notes",
	function* ({ root }) {
		yield* Effect.sync(() => git(root, "switch", "-c", "release"));
		yield* applyRelease(root, config);
		yield* Effect.sync(() => {
			git(root, "add", ".");
			git(root, "commit", "-m", "Collect release");
			git(root, "switch", "main");
		});
		yield* (yield* FileSystem.FileSystem).writeFileString(
			join(root, ".changeset/later.md"),
			'---\n"@shivaedev/platform": minor\n---\n\n### Breaking\n\n- Replace an API; migrate to its replacement.\n',
		);
		yield* Effect.sync(() => {
			git(root, "add", ".");
			git(root, "commit", "-m", "Replace platform API");
			git(root, "switch", "release");
			git(root, "merge", "--no-edit", "main");
		});
	},
);
