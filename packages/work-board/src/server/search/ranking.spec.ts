import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { fleetItemRankingFixture, identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchMatch } from "./match.ts";

it.live("ranks opted-in Fleet decision items after ordinary work but before every heading or passage", function* () {
	const { files, modified } = fleetItemRankingFixture();
	const snapshot = yield* fixtureSnapshot(files, undefined, modified);
	const results = searchMatch(snapshot.entries, "records: watch", snapshot.modified).results;
	expect(results.slice(0, 4).map((entry) => [entry.kind, entry.id])).toEqual([
		["document", "task.review"],
		["document", "task.watch-done"],
		["document", "decision.watch"],
		["document", "decision.policy"],
	]);
	expect(results[3]?.snippet).toBe("The watch needs a policy.");
	expect(results.slice(4).every((entry) => entry.kind !== "document" || !entry.itemKind)).toBe(true);
	expect(results.some((entry) => entry.kind === "heading" && !entry.record)).toBe(true);
	expect(results.some((entry) => entry.kind === "passage" && !entry.record)).toBe(true);
	expect(searchMatch(snapshot.entries, "watch").results.some((entry) => entry.record)).toBe(false);
});

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

it.live.each([
	{ first: "task.inbox", passageStatus: "planned", titleStatus: "planned" },
	{ first: "task.inbox", passageStatus: "active", titleStatus: "planned" },
	{ first: "task.inbox", passageStatus: "done", titleStatus: "planned" },
	{ first: "task.inbox", passageStatus: "deferred", titleStatus: "planned" },
	{ first: "task.inbox", passageStatus: "planned", titleStatus: "active" },
	{ first: "task.inbox", passageStatus: "active", titleStatus: "active" },
	{ first: "task.inbox", passageStatus: "done", titleStatus: "active" },
	{ first: "task.inbox", passageStatus: "deferred", titleStatus: "active" },
	{ first: "task.notes", passageStatus: "planned", titleStatus: "done" },
	{ first: "task.notes", passageStatus: "active", titleStatus: "done" },
	{ first: "task.inbox", passageStatus: "done", titleStatus: "done" },
	{ first: "task.inbox", passageStatus: "deferred", titleStatus: "done" },
	{ first: "task.notes", passageStatus: "planned", titleStatus: "deferred" },
	{ first: "task.notes", passageStatus: "active", titleStatus: "deferred" },
	{ first: "task.inbox", passageStatus: "done", titleStatus: "deferred" },
	{ first: "task.inbox", passageStatus: "deferred", titleStatus: "deferred" },
])("ranks $titleStatus title/ID and $passageStatus passage matches by status, then relevance", function* ({ first, passageStatus, titleStatus }) {
	const { files, modified } = identityRankingFixture(titleStatus, passageStatus);
	const snapshot = yield* fixtureSnapshot(files, undefined, modified);
	for (const query of ["inbox", "task.inbox"]) {
		const results = searchMatch(snapshot.entries, query, snapshot.modified).results;
		expect(results[0]?.id).toBe(first);
		expect(results.find((entry) => entry.id === "task.inbox" && entry.kind === "document")).toMatchObject({
			status: titleStatus,
			title: "Inbox triage",
		});
		expect(results.find((entry) => entry.id === "task.notes")).toMatchObject({ kind: "document", status: passageStatus });
	}
});
