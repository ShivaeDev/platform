import { expect } from "vitest";
import { boardStory, projectFiles, serverReading } from "#test/boardStory.ts";
import { modifiedNotes } from "#test/readingTraits.ts";
import { fleetItemRankingFixture, identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";

const fleet = fleetItemRankingFixture();
boardStory.it(
	"ranks all items by status, title/ID relevance and recency before every heading or passage",
	[serverReading(), projectFiles(fleet.files), modifiedNotes(fleet.modified)],
	function* ({ search }) {
		const results = (yield* search("records: watch")).results;
		expect(results.slice(0, 4).map((entry) => [entry.kind, entry.id])).toEqual([
			["document", "decision.watch"],
			["document", "decision.policy"],
			["document", "task.review"],
			["document", "task.watch-done"],
		]);
		expect(results[1]?.snippet).toBe("The watch needs a policy.");
		expect(results.slice(4).every((entry) => entry.kind !== "document" || !entry.itemKind)).toBe(true);
		expect(results.some((entry) => entry.kind === "heading" && entry.file === "notes.md")).toBe(true);
		expect(results.some((entry) => entry.kind === "passage" && entry.file === "open.md")).toBe(true);
		expect((yield* search("watch")).results.some((entry) => entry.file.startsWith("decision-"))).toBe(false);
	},
);

const ranked = searchRankingFixture();
boardStory.it(
	"ranks open work before closed or deferred work, then title matches and most recently changed sources",
	[serverReading(), projectFiles(ranked.files), modifiedNotes(ranked.modified)],
	function* ({ search }) {
		const results = (yield* search("watch")).results;
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
	},
);

for (const { first, passageStatus, titleStatus } of [
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
]) {
	const { files, modified } = identityRankingFixture(titleStatus, passageStatus);
	boardStory.it(
		`ranks ${titleStatus} title/ID and ${passageStatus} passage matches by status, then relevance`,
		[serverReading(), projectFiles(files), modifiedNotes(modified)],
		function* ({ search }) {
			for (const query of ["inbox", "task.inbox"]) {
				const results = (yield* search(query)).results;
				expect(results[0]?.id).toBe(first);
				expect(results.find((entry) => entry.id === "task.inbox" && entry.kind === "document")).toMatchObject({
					status: titleStatus,
					title: "Inbox triage",
				});
				expect(results.find((entry) => entry.id === "task.notes")).toMatchObject({ kind: "document", status: passageStatus });
			}
		},
	);
}
