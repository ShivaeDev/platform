import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { fleetItemRankingFixture } from "#test/searchRankingFixture.ts";
import { searchOpened } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const { files, modified } = fleetItemRankingFixture();

screenStory.it(
	"searching watch lists the Done watch title match, then the open task that mentions it, then the notes heading, each task with its status",
	[searchOpened(files, { home: undefined, modified })],
	function* ({ results, searchFor }) {
		yield* searchFor("watch");

		expect(yield* results("title", "status", "snippet")).toEqual([
			{ snippet: undefined, status: "Done", title: "Done watch" },
			{ snippet: "The watch keeps running.", status: "Ready", title: "Keep reviews visible" },
			{ snippet: "Watch details.", status: undefined, title: "Watch notes" },
		]);
	},
);

screenStory.it(
	"searching watch leaves out Fleet's status report, its reports and its decision records",
	[searchOpened(files, { home: undefined, modified })],
	function* ({ results, searchFor }) {
		yield* searchFor("watch");

		expect(yield* results("href")).toEqual([
			{ href: "/_board/item/task.watch-done/" },
			{ href: "/_board/item/task.review/" },
			{ href: "/notes.md#heading-watch-notes" },
		]);
	},
);

screenStory.it(
	"searching records: watch ranks the Watch decision first, then the other matching work and notes, then Fleet's reports",
	[searchOpened(files, { home: undefined, modified })],
	function* ({ results, searchFor }) {
		yield* searchFor("records: watch");

		expect((yield* results("title", "href")).slice(0, 8)).toEqual([
			{ href: "/_board/item/decision.watch/", title: "Watch decision" },
			{ href: "/_board/item/task.watch-done/", title: "Done watch" },
			{ href: "/_board/item/decision.policy/", title: "Review policy" },
			{ href: "/_board/item/task.review/", title: "Keep reviews visible" },
			{ href: "/notes.md#heading-watch-notes", title: "Watch notes" },
			{ href: "/responses/fleet-report.2026-10-15.md", title: "Archived watch report" },
			{ href: "/responses/fleet-report.md", title: "Watch report" },
			{ href: "/fleet/status.md", title: "Watch report" },
		]);
	},
);
