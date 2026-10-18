import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { homeLinks } from "#test/homeLinks.ts";
import { rpcDocument, rpcNavigation } from "#test/nativeRpc.ts";
import { outsideFiles } from "#test/servingTraits.ts";

const readingProject = [
	projectFiles({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	}),
	boardHome("plan.md"),
	outsideFiles({ "private.md": "# Outside the folder\n" }),
];

describe("the home file", () => {
	boardStory.it("is resolved relative to the folder", readingProject, function* ({ board, start }) {
		yield* board.stop();
		board = yield* start({ home: "./notes/../plan.md" });
		expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
	});

	boardStory.it("refuses a home symlink that leads outside the folder", readingProject, function* ({ board, notes, outside, start }) {
		yield* board.stop();
		homeLinks.outside(notes.root, outside.root);
		expect(yield* Effect.flip(start({ home: "home-link.md" }))).toMatchObject({
			message: expect.stringContaining("The home file home-link.md is not a markdown file in"),
		});
		board = yield* start({ home: "plan.md" });
	});

	boardStory.it(
		"resolves a name that differs only in case to the listed file where the file system ignores case",
		readingProject,
		function* ({ board, notes, start, editFile }) {
			yield* board.stop();
			editFile("Upper.md", "# Upper\n\n## Doing\n\n### One\n");
			if (existsSync(join(notes.root, "UPPER.md"))) {
				board = yield* start({ home: "upper.md" });
				const home = (yield* rpcNavigation(board)).home;
				expect(home?.file).toBe("Upper.md");
				const homeDocument = yield* rpcDocument(board, `/${home?.file}`);
				expect(homeDocument.file).toBe("Upper.md");
				expect(homeDocument.source).toContain("### One");
			} else {
				expect(yield* Effect.flip(start({ home: "upper.md" }))).toMatchObject({
					message: expect.stringContaining("The home file upper.md is not a markdown file in"),
				});
				board = yield* start({ home: "plan.md" });
			}
		},
	);

	boardStory.it(
		"picks the file with the requested name over a symlink or a hard link to it when a name differs only in case",
		readingProject,
		function* ({ board, notes, start }) {
			yield* board.stop();
			homeLinks.aliases(notes.root);
			if (existsSync(join(notes.root, "PLAN.md"))) {
				board = yield* start({ home: "PLAN.md" });
				expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
			} else {
				expect(yield* Effect.flip(start({ home: "PLAN.md" }))).toMatchObject({
					message: expect.stringContaining("The home file PLAN.md is not a markdown file in"),
				});
				board = yield* start({ home: "plan.md" });
			}
		},
	);

	boardStory.it("picks the file over a symlink to it when the home is reached another way", readingProject, function* ({ board, notes, start }) {
		yield* board.stop();
		homeLinks.nestedAlias(notes.root);
		board = yield* start({ home: ".drafts/plan-copy.md" });
		expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
	});

	boardStory.it("must exist, or the board does not start", readingProject, function* ({ board, notes, start }) {
		yield* board.stop();
		expect(yield* Effect.flip(start({ home: "missing.md" }))).toMatchObject({
			_tag: "HomeMissing",
			message: `The home file missing.md is not a markdown file in ${notes.root}. Choose an existing Markdown file with --home.`,
		});
		board = yield* start({ home: "plan.md" });
	});
});
