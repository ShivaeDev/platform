import { Effect } from "effect";
import { expect } from "vitest";
import { changelog, EDITOR, QUERY, releaseIsCut } from "#changelog/test-support/kit.ts";

changelog.it("keeps a later fragment pending when it lands on the release base", [releaseIsCut()], function* ({ checks, laterFragmentLands, read }) {
	const manifest = read("release.json");
	laterFragmentLands();
	yield* checks();
	expect(read("changes/query.md")).toBe(QUERY);
	expect(read("release.json")).toBe(manifest);
	expect(read("CHANGELOG.md")).toContain("Save drafts.");
	expect(read("CHANGELOG.md")).not.toContain("Query subscriptions.");
});

changelog.it(
	"rejects released history edits even with a later fragment pending",
	[releaseIsCut()],
	function* ({ checks, edit, laterFragmentLands, read }) {
		laterFragmentLands();
		edit("CHANGELOG.md", read("CHANGELOG.md").replace("First release.", "Edited history."));
		expect((yield* Effect.flip(checks())).message).toMatch(/released history cannot be edited/u);
	},
);

changelog.it("rejects changelog edits without a version bump", [], function* ({ checks, edit, read }) {
	edit("CHANGELOG.md", read("CHANGELOG.md").replace("First release.", "Edited history."));
	expect((yield* Effect.flip(checks())).message).toMatch(/CHANGELOG.md changes only in a release/u);
});

changelog.it("rejects collected fragments left behind", [releaseIsCut()], function* ({ checks, edit, laterFragmentLands }) {
	laterFragmentLands();
	edit("changes/editor.md", EDITOR);
	expect((yield* Effect.flip(checks())).message).toMatch(/collect and delete/u);
});

changelog.it("rejects changes to collected base fragments", [releaseIsCut()], function* ({ checks, edit, laterFragmentLands, read }) {
	laterFragmentLands();
	edit("release.json", read("release.json").replace("Save drafts.", "Different release notes."));
	expect((yield* Effect.flip(checks())).message).toMatch(/existing fragments unchanged/u);
});

changelog.it("rejects release notes that differ from the manifest", [releaseIsCut()], function* ({ checks, edit, laterFragmentLands, read }) {
	laterFragmentLands();
	edit("CHANGELOG.md", read("CHANGELOG.md").replace("Save drafts.", "Different release notes."));
	expect((yield* Effect.flip(checks())).message).toMatch(/release notes must match/u);
});

changelog.it("rejects editing an uncollected base fragment", [releaseIsCut()], function* ({ checks, edit, laterFragmentLands }) {
	laterFragmentLands();
	edit("changes/query.md", "### Added\n\n- Different queries.\n");
	expect((yield* Effect.flip(checks())).message).toMatch(/existing fragments unchanged/u);
});

changelog.it("rejects deleting an uncollected base fragment", [releaseIsCut()], function* ({ checks, laterFragmentLands, remove }) {
	laterFragmentLands();
	remove("changes/query.md");
	expect((yield* Effect.flip(checks())).message).toMatch(/existing fragments unchanged/u);
});
