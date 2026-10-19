import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { modifiedNotes } from "#test/readingTraits.ts";
import {
	crossGroupRankingFixture,
	exactRankingFixture,
	fleetItemRankingFixture,
	identityRankingFixture,
	searchRankingFixture,
} from "#test/searchRankingFixture.ts";

const fleet = fleetItemRankingFixture();
boardStory.it(
	"ranks all items by title/ID relevance, status and recency before every heading or passage",
	[projectFiles(fleet.files), modifiedNotes(fleet.modified)],
	function* ({ search }) {
		const results = (yield* search("records: watch")).results;
		expect(results.slice(0, 4).map((entry) => [entry.kind, entry.id])).toEqual([
			["document", "decision.watch"],
			["document", "task.watch-done"],
			["document", "decision.policy"],
			["document", "task.review"],
		]);
		expect(results[2]?.snippet).toBe("The watch needs a policy.");
		expect(results.slice(4).every((entry) => entry.kind !== "document" || !entry.itemKind)).toBe(true);
		expect(results.some((entry) => entry.kind === "heading" && entry.file === "notes.md")).toBe(true);
		expect(results.filter((entry) => entry.file === "open.md")).toEqual([
			expect.objectContaining({ href: "/_board/item/task.review/", kind: "document", snippet: "The watch keeps running." }),
		]);
		expect((yield* search("watch")).results.some((entry) => entry.file.startsWith("decision-"))).toBe(false);
	},
);

const ranked = searchRankingFixture();
boardStory.it(
	"ranks title matches before body matches, then open work before closed or deferred work and most recently changed sources",
	[projectFiles(ranked.files), modifiedNotes(ranked.modified)],
	function* ({ search }) {
		const results = (yield* search("watch")).results;
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
	},
);

for (const titleStatus of ["planned", "active", "done", "deferred"]) {
	for (const passageStatus of ["planned", "active", "done", "deferred"]) {
		const { files, modified } = identityRankingFixture(titleStatus, passageStatus);
		boardStory.it(
			`ranks a ${titleStatus} title/ID match above a newer ${passageStatus} passage match`,
			[projectFiles(files), modifiedNotes(modified)],
			function* ({ search }) {
				for (const query of ["inbox", "task.inbox"]) {
					const results = (yield* search(query)).results;
					expect(results[0]).toMatchObject({ id: "task.inbox", kind: "document", status: titleStatus, title: "Inbox triage" });
					expect(results.find((entry) => entry.id === "task.notes")).toMatchObject({ kind: "document", status: passageStatus });
				}
			},
		);
	}
}

const exact = exactRankingFixture();
boardStory.it(
	"ranks an exact ID or title match first, then title matches, then newer open work that only mentions the words",
	[projectFiles(exact.files), modifiedNotes(exact.modified)],
	function* ({ search }) {
		for (const query of ["answer card", "Answer-Card", "board.answer-card", "Answering a decision is one obvious action on its page"]) {
			const items = (yield* search(query)).results.filter((entry) => entry.kind === "document").map((entry) => entry.id);
			expect(items[0]).toBe("board.answer-card");
		}
		const items = (yield* search("answer card")).results.filter((entry) => entry.kind === "document").map((entry) => entry.id);
		expect(items).toEqual(["board.answer-card", "board.answer-card-polish", "quality.baseline"]);
	},
);

boardStory.it(
	"ranks an exact or multi-word prefix title match first even when it is a plain document behind many work items",
	[projectFiles(crossGroupRankingFixture(45))],
	function* ({ search }) {
		const prefix = (yield* search("Work Board on client-rendered React")).results;
		expect(prefix[0]).toMatchObject({ file: "plans/board-react.md", match: "prefix" });
		expect(prefix.slice(1).every((entry) => entry.match === "text")).toBe(true);
		expect((yield* search("work board on client rendered react slice plan")).results[0]).toMatchObject({
			file: "plans/board-react.md",
			match: "exact",
		});
		expect((yield* search("connection budget")).results.map((entry) => [entry.file, entry.match]).slice(0, 2)).toEqual([
			["notes/budget.md", "exact"],
			["boards/platform.md", "text"],
		]);
	},
);
