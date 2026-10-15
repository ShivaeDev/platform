import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchMatch } from "./match.ts";

it.live("ranks title matches before body matches, then open work and most recently changed sources", function* () {
	const { files, modified } = searchRankingFixture();
	const snapshot = yield* fixtureSnapshot(files, undefined, modified);
	const results = searchMatch(snapshot.entries, "watch", snapshot.modified).results;
	const sources = [...new Set(results.map((entry) => entry.file))];
	expect(sources).toEqual([
		"planned.md",
		"needs-you.md",
		"active.md",
		"held.md",
		"done.md",
		"deferred.md",
		"superseded.md",
		"open-body.md",
		"done-body.md",
	]);
});

const states = ["active", "done", "deferred"];
it.live.each(states.flatMap((titleStatus) => states.map((passageStatus) => ({ passageStatus, titleStatus }))))(
	"ranks a $titleStatus title or ID match before a newer $passageStatus passage",
	function* ({ passageStatus, titleStatus }) {
		const { files, modified } = identityRankingFixture(titleStatus, passageStatus);
		const snapshot = yield* fixtureSnapshot(files, undefined, modified);
		for (const query of ["inbox", "task.inbox"]) {
			const results = searchMatch(snapshot.entries, query, snapshot.modified).results;
			expect(results[0]).toMatchObject({ id: "task.inbox", kind: "document", status: titleStatus, title: "Inbox triage" });
			expect(results.some((entry) => entry.file === "passage.md" && entry.kind === "passage")).toBe(true);
		}
	},
);
