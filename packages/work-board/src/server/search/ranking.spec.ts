import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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
const fleetItems = [projectFiles(fleet.files), modifiedNotes(fleet.modified)];

boardStory.it(
	"a records: search ranks every matching item by title or ID, then status and recency, before any heading or passage",
	fleetItems,
	function* ({ rankedResults, resultIds }) {
		yield* outcomes({
			"first five results": [
				rankedResults("records: watch", 5),
				["item decision.watch", "item task.watch-done", "item decision.policy", "item task.review", "heading /notes.md#heading-watch-notes"],
			],
			"item results": [resultIds("records: watch"), ["decision.watch", "task.watch-done", "decision.policy", "task.review"]],
		});
	},
);

boardStory.it(
	"an item matched only in its body is one result that links to its item page with the matching sentence as snippet",
	fleetItems,
	function* ({ resultsFrom }) {
		expect(yield* resultsFrom("records: watch", "open.md")).toEqual([
			expect.objectContaining({ href: "/_board/item/task.review/", kind: "document", snippet: "The watch keeps running." }),
		]);
	},
);

boardStory.it("a plain search leaves out the Fleet decision records", fleetItems, function* ({ resultSources }) {
	expect(yield* resultSources("watch")).toEqual(["done.md", "open.md", "notes.md"]);
});

const ranked = searchRankingFixture();

boardStory.it(
	"title matches come before body matches, then open work before closed or deferred work, then the most recently changed",
	[projectFiles(ranked.files), modifiedNotes(ranked.modified)],
	function* ({ resultSources }) {
		expect(yield* resultSources("watch")).toEqual([
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

for (const titleStatus of ["draft", "ready", "done", "deferred"]) {
	const { files, modified } = identityRankingFixture(titleStatus, "ready");
	for (const query of ["inbox", "task.inbox"]) {
		boardStory.it(
			`searching ${query} ranks a ${titleStatus} item matched by title or ID above a newer ready item matched in a passage`,
			[projectFiles(files), modifiedNotes(modified)],
			function* ({ resultIds }) {
				expect(yield* resultIds(query)).toEqual(["task.inbox", "task.notes"]);
			},
		);
	}
}

const exact = exactRankingFixture();
const exactItems = [projectFiles(exact.files), modifiedNotes(exact.modified)];

for (const query of ["answer card", "Answer-Card", "board.answer-card", "Answering a decision is one obvious action on its page"]) {
	boardStory.it(`searching ${JSON.stringify(query)} finds the exactly matching item first`, exactItems, function* ({ resultIds }) {
		expect(yield* resultIds(query)).toEqual(expect.arrayContaining(["board.answer-card"]));
	});
}

boardStory.it(
	"an exact title match comes first, then other title matches, then newer open work that only mentions the words",
	exactItems,
	function* ({ resultIds }) {
		expect(yield* resultIds("answer card")).toEqual(["board.answer-card", "board.answer-card-polish", "quality.baseline"]);
	},
);

const crossGroup = projectFiles(crossGroupRankingFixture(45));

boardStory.it(
	"a plain document whose title starts with the words comes first as a prefix match, ahead of 45 work items matching only in text",
	[crossGroup],
	function* ({ resultMatches }) {
		expect(yield* resultMatches("Work Board on client-rendered React")).toEqual([
			"prefix plans/board-react.md",
			...Array.from({ length: 39 }, () => expect.stringMatching(/^text /u)),
		]);
	},
);

boardStory.it("a query spelling a plain document's whole title finds it first as an exact match", [crossGroup], function* ({ firstResult }) {
	expect(yield* firstResult("work board on client rendered react slice plan")).toMatchObject({ file: "plans/board-react.md", match: "exact" });
});

boardStory.it("an exact title match ranks above a board that mentions the words", [crossGroup], function* ({ resultMatches }) {
	expect(yield* resultMatches("connection budget", 2)).toEqual(["exact notes/budget.md", "text boards/platform.md"]);
});
