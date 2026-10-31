import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";
import { watchedBoardReads } from "#test/watchedBoardReads.ts";

boardReadStory.it(
	"a fresh read sees an edit the watched index has not observed while later passes keep the indexed brief",
	[hasBoardItems(1), watchedBoardReads()],
	function* ({ edit, readInPass }) {
		const indexed = yield* readInPass("item.0");
		yield* edit("0.md", "item.0", false, "An edit outside the observed index.");

		const fresh = yield* readInPass("item.0", { fresh: true });

		expect(fresh.approved).toBe(false);
		expect(yield* readInPass("item.0")).toEqual(indexed);
	},
);

boardReadStory.it(
	"a read within a pass keeps the brief it first read after the file is edited",
	[hasBoardItems(1)],
	function* ({ duringOnePass, edit, read }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const original = yield* read("item.0");
				yield* edit("0.md", "item.0", false, "Changed during the pass.");

				expect(yield* read("item.0")).toEqual(original);
			}),
		);
	},
);

boardReadStory.it(
	"a fresh read within a pass rereads only its own file, and later reads in the pass see the new brief",
	[hasBoardItems(2)],
	function* ({ duringOnePass, edit, read, readFiles, revisionMatchesMetadata, scannedFolders }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				yield* read("item.0");
				yield* read("item.1");
				yield* edit("0.md", "item.0", false, "Changed during the pass.");

				const fresh = yield* read("item.0", { fresh: true });

				expect(fresh).toMatchObject({ approved: false });
				yield* outcomes([
					["fresh revision matches its metadata", () => revisionMatchesMetadata(fresh), true],
					["later read", () => read("item.0"), fresh],
					["scanned folders", () => scannedFolders(), ["."]],
					[
						"read files",
						() => readFiles().pipe(Effect.map((files) => [...files.slice(0, -1).toSorted(), ...files.slice(-1)])),
						["0.md", "1.md", "0.md"],
					],
				]);
			}),
		);
	},
);

boardReadStory.it(
	"a fresh read fails with the file named when its cached source becomes unreadable",
	[hasBoardItems(1)],
	function* ({ approvalOf, duringOnePass, makeUnreadable, refusalOf }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				expect(yield* approvalOf("item.0")).toBe("approved");

				makeUnreadable("0.md");

				expect(yield* refusalOf("item.0", { fresh: true })).toContain("Board source could not be read: 0.md");
			}),
		);
	},
);
