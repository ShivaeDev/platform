import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { openedAt, reportApps } from "#test/query-failures/story.tsx";

reportApps.it(
	"a route's query that fails to refresh with a shared rejection keeps the report and shows the server's message with Retry",
	[openedAt("/report")],
	function* ({ heading, noticeActions, notices, pressRefresh, serverAnswers, serverRenames }) {
		yield* serverRenames("Annual report");
		yield* serverAnswers("Conflict");

		yield* pressRefresh();

		yield* outcomes([
			["heading", () => heading(), "Quarterly report"],
			["notices", () => notices(), ["The report changed while it was read"]],
			["notice actions", () => noticeActions(), ["Retry", "Dismiss"]],
		]);
	},
);

for (const [answer, shown] of [
	["ServiceUnavailable", "Out of service (unavailable)"],
	["AuthUnavailable", "Out of service (unavailable)"],
	["InternalServerError", "Out of service (unexpected)"],
] as const) {
	reportApps.it(
		`a route's query that fails to refresh with ${answer} keeps the report and shows the failure host's wording`,
		[openedAt("/report", "its failure host's own wording")],
		function* ({ heading, notices, pressRefresh, serverAnswers }) {
			yield* serverAnswers(answer);

			yield* pressRefresh();

			yield* outcomes([
				["heading", () => heading(), "Quarterly report"],
				["notices", () => notices(), [shown]],
			]);
		},
	);
}

for (const answer of ["a defect", "an untagged failure"] as const) {
	reportApps.it(
		`a route's query read in the browser that fails to refresh with ${answer} shows the default wording without its cause`,
		[openedAt("/summary")],
		function* ({ heading, notices, pressRefresh, summaryAnswers }) {
			yield* summaryAnswers(answer);

			yield* pressRefresh();

			yield* outcomes([
				["heading", () => heading(), "Quarterly report summary"],
				["notices", () => notices(), ["Something went wrong. Try again."]],
			]);
		},
	);
}

reportApps.it(
	"Retry in a route query's failure notice reads the report again and the notice goes when the read succeeds",
	[openedAt("/report")],
	function* ({ heading, notices, pressRefresh, pressRetry, serverAnswers, serverRenames }) {
		yield* serverAnswers("TooManyRequests");
		yield* pressRefresh();
		yield* serverRenames("Annual report");
		expect(yield* notices()).toEqual(["Too many reads. Wait a moment."]);

		yield* pressRetry();

		yield* outcomes([
			["heading", () => heading(), "Annual report"],
			["notices", () => notices(), []],
		]);
	},
);

reportApps.it(
	"a route's query that fails again after Retry shows one notice, not two",
	[openedAt("/report")],
	function* ({ notices, pressRefresh, pressRetry, serverAnswers }) {
		yield* serverAnswers("Conflict", "TooManyRequests");
		yield* pressRefresh();

		yield* pressRetry();

		expect(yield* notices()).toEqual(["Too many reads. Wait a moment."]);
	},
);

reportApps.it(
	"a route's query that fails to refresh with the app's own ReportArchived shows what the route's handler returns",
	[openedAt("/report")],
	function* ({ notices, pressRefresh, serverAnswers }) {
		yield* serverAnswers("ReportArchived");

		yield* pressRefresh();

		expect(yield* notices()).toEqual(["The 2024 report is archived"]);
	},
);

reportApps.it(
	"an editor on the route's loaded report keeps the draft when its query fails to refresh and shows the failure host's wording",
	[openedAt("/report/edit", "its failure host's own wording")],
	function* ({ edit, notices, pressRefresh, serverAnswers, title }) {
		yield* edit("Draft title");
		yield* serverAnswers("ServiceUnavailable");

		yield* pressRefresh();

		yield* outcomes([
			["title", () => title(), "Draft title"],
			["notices", () => notices(), ["Out of service (unavailable)"]],
		]);
	},
);

reportApps.it(
	"an editor on the route's loaded report shows a shared rejection's message when its query fails to refresh, and Retry clears it",
	[openedAt("/report/edit")],
	function* ({ notices, pressRefresh, pressRetry, serverAnswers }) {
		yield* serverAnswers("Conflict");
		yield* pressRefresh();
		expect(yield* notices()).toEqual(["The report changed while it was read"]);

		yield* pressRetry();

		expect(yield* notices()).toEqual([]);
	},
);

for (const [answer, wording, shown] of [
	["ServiceUnavailable", "its failure host's own wording", "Out of service (unavailable)"],
	["Conflict", "its default failure wording", "The report changed while it was read"],
] as const) {
	reportApps.it(
		`a route whose first read fails with ${answer} shows the default failure screen worded as a notice would be`,
		[openedAt("/report", wording, answer)],
		function* ({ notices, screenFailure }) {
			yield* outcomes([
				["failure screen", () => screenFailure(), [`${shown} Retry`]],
				["notices", () => notices(), []],
			]);
		},
	);
}

for (const [answer, declared, shown] of [
	["ReportArchived", "a handler", "The 2024 report is archived"],
	["ReportLocked", '"message"', "The report is locked for the audit"],
] as const) {
	reportApps.it(
		`a route whose first read fails with the app's own ${answer}, declared with ${declared}, shows what its refresh notice would, without Retry`,
		[openedAt("/report", "its default failure wording", answer)],
		function* ({ notices, retryOffered, screenFailure }) {
			yield* outcomes([
				["failure screen", () => screenFailure(), [shown]],
				["Retry offered", () => retryOffered(), false],
				["notices", () => notices(), []],
			]);
		},
	);
}

reportApps.it(
	"a route's query that fails to refresh with the app's own ReportLocked, declared with \"message\", shows the server's message",
	[openedAt("/report")],
	function* ({ notices, pressRefresh, serverAnswers }) {
		yield* serverAnswers("ReportLocked");

		yield* pressRefresh();

		expect(yield* notices()).toEqual(["The report is locked for the audit"]);
	},
);

reportApps.it(
	"an app's own failure screen shows a declared rejection on first load without Retry",
	[openedAt("/report/edit", "its own failure screen for every route", "ReportArchived")],
	function* ({ retryOffered, screenFailure }) {
		yield* outcomes([
			["failure screen", () => screenFailure(), ["The 2024 report is archived"]],
			["Retry offered", () => retryOffered(), false],
		]);
	},
);

reportApps.it(
	"a route whose first read in the browser dies shows the default failure screen without the defect",
	[openedAt("/summary", "its default failure wording", "a defect")],
	function* ({ screenFailure }) {
		expect(yield* screenFailure()).toEqual(["Something went wrong. Try again. Retry"]);
	},
);

reportApps.it(
	"Retry on the default failure screen reads the route's query again and shows the report",
	[openedAt("/report", "its default failure wording", "ServiceUnavailable")],
	function* ({ heading, pressRetry, reads, screenFailure }) {
		expect(yield* reads()).toBe("once");

		yield* pressRetry();

		yield* outcomes([
			["heading", () => heading(), "Quarterly report"],
			["failure screen", () => screenFailure(), []],
			["reads", () => reads(), "twice"],
		]);
	},
);

reportApps.it(
	"an app's own failure screen replaces the default for every route",
	[openedAt("/report/edit", "its own failure screen for every route", "InternalServerError")],
	function* ({ heading, screenFailure }) {
		yield* outcomes([
			["heading", () => heading(), "This page could not load"],
			["failure screen", () => screenFailure(), ["Out of service (unexpected)"]],
		]);
	},
);
