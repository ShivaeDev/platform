import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchMatch } from "./match.ts";

it.live("ranks open work before closed or deferred work, then title matches and most recently changed sources", function* () {
	const { files, modified } = searchRankingFixture();
	const snapshot = yield* fixtureSnapshot(files, undefined, modified);
	const results = searchMatch(snapshot.entries, "watch", snapshot.modified).results;
	const sources = [...new Set(results.map((entry) => entry.file))];
	expect(sources).toEqual([
		"planned.md",
		"needs-you.md",
		"active.md",
		"held.md",
		"open-body.md",
		"done.md",
		"deferred.md",
		"superseded.md",
		"done-body.md",
	]);
});
