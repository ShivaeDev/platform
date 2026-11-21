import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { git } from "#release/test-support/git.ts";
import { repository } from "#release/test-support/repository.ts";

export const WORK_BOARD_BREAKING = "Remove `legacyRoute`; use `route`.";

export const platformShell = repository.trait(
	"pending",
	`main holds platform as a shell exporting only its package.json over work-board, which the starter also pins, and breaking.md gives work-board the Breaking entry "${WORK_BOARD_BREAKING}"`,
	function* ({ root }) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.writeFileString(
			join(root, "packages/platform/package.json"),
			JSON.stringify({
				dependencies: { "@shivaedev/work-board": "workspace:*" },
				exports: { "./package.json": "./package.json" },
				name: "@shivaedev/platform",
				version: "0.15.0",
			}),
		);
		yield* fs.writeFileString(
			join(root, "examples/starter/published-versions.json"),
			'{"@shivaedev/platform":"0.15.0","@shivaedev/work-board":"0.4.0","@shivaedev/work-fleet":"0.3.0"}\n',
		);
		yield* fs.writeFileString(
			join(root, ".changeset/breaking.md"),
			`---\n"@shivaedev/work-board": minor\n---\n\n### Breaking\n\n- ${WORK_BOARD_BREAKING}\n`,
		);
		yield* Effect.sync(() => {
			git(root, "add", ".");
			git(root, "commit", "-m", "Platform shell over a breaking work-board");
		});
	},
);
