import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { homeLinks } from "#test/homeLinks.ts";
import { rpcNavigation } from "#test/nativeRpc.ts";

let notes: Folder;
let outside: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	outside = folder({ "private.md": "# Outside the folder\n" });
	notes = folder({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	});
	board = yield* startBoard(notes.root, "plan.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
	outside.remove();
});

function get(path: string) {
	return fetch(`${board.url}${path}`);
}

describe("the home file", () => {
	effectApp("is resolved relative to the folder", function* () {
		yield* board.stop();
		board = yield* startBoard(notes.root, "./notes/../plan.md");
		expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
	});

	effectApp("refuses a home symlink that leads outside the folder", function* () {
		yield* board.stop();
		homeLinks.outside(notes.root, outside.root);
		expect(yield* Effect.flip(startBoard(notes.root, "home-link.md"))).toMatchObject({
			message: expect.stringContaining("The home file home-link.md is not a markdown file in"),
		});
		board = yield* startBoard(notes.root, "plan.md");
	});

	effectApp("resolves a name that differs only in case to the listed file where the file system ignores case", function* () {
		yield* board.stop();
		notes.write("Upper.md", "# Upper\n\n## Doing\n\n### One\n");
		if (existsSync(join(notes.root, "UPPER.md"))) {
			board = yield* startBoard(notes.root, "upper.md");
			const html = yield* Effect.promise(async () => (await get("/")).text());
			expect(html).toContain("<span><b>1</b> doing</span>");
			expect((yield* rpcNavigation(board)).home?.file).toBe("Upper.md");
		} else {
			expect(yield* Effect.flip(startBoard(notes.root, "upper.md"))).toMatchObject({
				message: expect.stringContaining("The home file upper.md is not a markdown file in"),
			});
			board = yield* startBoard(notes.root, "plan.md");
		}
	});

	effectApp("picks the file with the requested name over a symlink or a hard link to it when a name differs only in case", function* () {
		yield* board.stop();
		homeLinks.aliases(notes.root);
		if (existsSync(join(notes.root, "PLAN.md"))) {
			board = yield* startBoard(notes.root, "PLAN.md");
			expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
		} else {
			expect(yield* Effect.flip(startBoard(notes.root, "PLAN.md"))).toMatchObject({
				message: expect.stringContaining("The home file PLAN.md is not a markdown file in"),
			});
			board = yield* startBoard(notes.root, "plan.md");
		}
	});

	effectApp("picks the file over a symlink to it when the home is reached another way", function* () {
		yield* board.stop();
		homeLinks.nestedAlias(notes.root);
		board = yield* startBoard(notes.root, ".drafts/plan-copy.md");
		expect((yield* rpcNavigation(board)).home?.file).toBe("plan.md");
	});

	effectApp("must exist, or the board does not start", function* () {
		yield* board.stop();
		expect(yield* Effect.flip(startBoard(notes.root, "missing.md"))).toMatchObject({
			_tag: "HomeMissing",
			message: `The home file missing.md is not a markdown file in ${notes.root}. Choose an existing Markdown file with --home.`,
		});
		board = yield* startBoard(notes.root, "plan.md");
	});
});
