import { DateTime } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dashboardRows, queries, reportScoreIsInvalid } from "#test/queries.ts";

const tenAm = DateTime.makeUnsafe("2026-10-25T10:00:00Z");

const first = { pullRequestId: 1, reportId: 10, score: 7, title: "First", updatedAt: "2026-10-25T10:00:00.000Z" };
const latest = { pullRequestId: 3, reportId: 30, score: 9, title: "Latest", updatedAt: "2026-10-25T12:00:00.000Z" };

queries.it(
	"the dashboard's inner join reads the reported pull requests with numeric ids and scores and UTC times, leaving out Unreported",
	[dashboardRows()],
	function* ({ listReports }) {
		const reported = yield* listReports(tenAm);

		expect(reported).toEqual([first, latest]);
	},
);

queries.it("the dashboard's left join reads Unreported with a null report id and score", [dashboardRows()], function* ({ listPullRequests }) {
	const pullRequests = yield* listPullRequests(tenAm);

	expect(pullRequests).toEqual([
		first,
		{ pullRequestId: 2, reportId: null, score: null, title: "Unreported", updatedAt: "2026-10-25T11:00:00.000Z" },
		latest,
	]);
});

queries.it(
	"the dashboard encodes a 13:00+02:00 bound through the model's UTC codec into a bound Date and reads only Latest",
	[dashboardRows()],
	function* ({ boundParameters, lastResult, listReports }) {
		yield* listReports(DateTime.makeUnsafe("2026-10-25T13:00:00+02:00"));

		yield* outcomes({
			"bound parameters": [boundParameters(), [[new Date("2026-10-25T11:00:00Z")]]],
			"reported pull requests": [lastResult(), [latest]],
		});
	},
);

queries.it(
	"a stored score that the report model rejects fails the dashboard read with a schema error",
	[dashboardRows(), reportScoreIsInvalid()],
	function* ({ listReports }) {
		const reported = yield* listReports(tenAm);

		expect(reported).toBe("failed with a schema error");
	},
);

queries.it("the dashboard finds Latest's report as some decoded row", [dashboardRows()], function* ({ findReport }) {
	const report = yield* findReport(3);

	expect(report).toEqual({ some: latest });
});

queries.it("the dashboard finds none for Unreported, whose join matches nothing", [dashboardRows()], function* ({ findReport }) {
	const report = yield* findReport(2);

	expect(report).toBe("none");
});
