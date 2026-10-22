import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationReplacementFixture } from "#test/migrationReplacementFixture.ts";

boardStory.it(
	"links replacements named in next actions or legacy fields and lists successors it cannot find",
	[projectFiles(migrationReplacementFixture), deferredServing],
	function* ({ migrate, notes, start, rpc }) {
		const output = migrate();
		expect(output).toContain("Unresolved replacement: unknown.md: old.unknown -> task.missing\n");
		expect(output).toContain("Unresolved replacement: unnamed.md: old.unnamed -> <not named>\n");
		expect(output).not.toContain("old.already");
		const current = readFileSync(join(notes.root, "current.md"), "utf8");
		expect(current).toContain("  - kind: relates_to # keep this comment\n    target: task.other\n");
		const saved = Object.fromEntries(Object.keys(migrationReplacementFixture).map((file) => [file, readFileSync(join(notes.root, file), "utf8")]));
		expect(migrate()).toBe(`Changed 0 files and 0 fields.\n${output.slice(output.indexOf("Unresolved replacement:"))}`);
		expect(Object.fromEntries(Object.keys(migrationReplacementFixture).map((file) => [file, readFileSync(join(notes.root, file), "utf8")]))).toEqual(
			saved,
		);
		yield* start();
		const document = yield* rpc((client) => client("work-board.document", { url: "/current.md" }));
		expect(document.diagnostics).toEqual([]);
		expect(document.metadata.relationships?.filter((link) => link.kind === "replaces").map((link) => link.target)).toEqual([
			"old.already",
			"old.done",
			"old.dropped",
			"old.legacy",
			"old.multiple",
			"old.superseded",
		]);
		const other = yield* rpc((client) => client("work-board.document", { url: "/other.md" }));
		expect(other.metadata.relationships).toEqual([
			{ kind: "replaces", target: "old.field" },
			{ kind: "replaces", target: "old.multiple" },
		]);
	},
);
