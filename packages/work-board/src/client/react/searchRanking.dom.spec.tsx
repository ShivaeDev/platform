import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { crossGroupRankingFixture, identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchOpened } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const STATUS_LABELS: Readonly<Record<string, string>> = { deferred: "Deferred", done: "Done", draft: "Draft", ready: "Ready" };

{
	const { files, modified } = searchRankingFixture();
	screenStory.it(
		"searching watch lists every task titled with it before the tasks that only mention it",
		[searchOpened(files, { home: undefined, modified })],
		function* ({ resultTitles, searchFor }) {
			yield* searchFor("watch");

			expect(yield* resultTitles()).toEqual([
				"A running watch sees reviews finish",
				"Watch needs you",
				"Active watch",
				"Held watch",
				"Done watch",
				"Deferred watch",
				"Superseded watch",
				"Keep reviews visible",
				"Finished",
			]);
		},
	);
}

for (const titleStatus of ["ready", "done", "deferred"]) {
	for (const passageStatus of ["draft", titleStatus]) {
		for (const query of ["inbox", "task.inbox"]) {
			const { files, modified } = identityRankingFixture(titleStatus, passageStatus);
			screenStory.it(
				`searching ${query} lists the ${titleStatus} task named Inbox triage above the newer ${passageStatus} task that only mentions it`,
				[searchOpened(files, { home: undefined, modified })],
				function* ({ results, searchFor }) {
					yield* searchFor(query);

					expect(yield* results("title", "id", "status")).toEqual([
						{ id: "task.inbox", status: STATUS_LABELS[titleStatus], title: "Inbox triage" },
						{ id: "task.notes", status: STATUS_LABELS[passageStatus], title: "Captured notes" },
					]);
				},
			);
		}
	}
}

screenStory.it(
	"a plain document whose title starts with the query comes first, ahead of work that mentions it",
	[searchOpened(crossGroupRankingFixture())],
	function* ({ resultGroups, searchFor }) {
		yield* searchFor("Work Board on client-rendered React");

		expect(yield* resultGroups()).toEqual([
			{ group: "Documents", titles: ["Work Board on client-rendered React: slice plan"] },
			{ group: "Work", titles: ["Platform work", "Queries keep their data while they refresh 0"] },
		]);
	},
);

screenStory.it(
	"a document titled with the query puts Documents ahead of Work that only mentions it",
	[searchOpened(crossGroupRankingFixture())],
	function* ({ resultGroups, searchFor }) {
		yield* searchFor("budget");

		expect(yield* resultGroups()).toEqual([
			{ group: "Documents", titles: ["Connection budget"] },
			{ group: "Work", titles: ["Platform work", "Queries keep their data while they refresh 0"] },
		]);
	},
);

screenStory.it(
	"a goal named exactly comes ahead of a document whose title only starts with that name",
	[searchOpened({ ...paletteFixture(), "notes/calmer.md": "# A calmer workspace review\n\nNotes from the review.\n" })],
	function* ({ resultTitles, searchFor }) {
		yield* searchFor("A calmer workspace");

		expect(yield* resultTitles()).toEqual(["Go to A calmer workspace", "A calmer workspace review"]);
	},
);

screenStory.it("a goal in the results is labelled Goal", [searchOpened(paletteFixture())], function* ({ searchFor, searchResult }) {
	yield* searchFor("finished");

	expect(yield* searchResult("Finished workspace")).toMatchObject({ kind: "Goal" });
});
