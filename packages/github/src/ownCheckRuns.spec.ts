import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkListingRefused, checksFromSeveralApps, checkWithoutApp } from "#test/checkRunTraits.ts";
import { github } from "#test/github.ts";
import { HEAD } from "#test/writeTraits.ts";

github.it("lookup by name returns the newest run across all pages", [checksFromSeveralApps], function* ({ findCheck }) {
	expect(yield* findCheck({ headSha: HEAD, name: "Coverage" })).toMatchObject({ app: { id: 9 }, id: 99 });
});

github.it("lookup by app id returns that app's newest check regardless of name", [checksFromSeveralApps], function* ({ findCheck }) {
	expect(yield* findCheck({ appId: 7, headSha: HEAD })).toMatchObject({ id: 17, name: "Lint" });
});

github.it("lookup combines name and app ownership across pages and returns none when absent", [checksFromSeveralApps], function* ({ findCheck }) {
	yield* outcomes([
		["owned run", () => findCheck({ appId: 7, headSha: HEAD, name: "Coverage" }), { app: { id: 7 }, id: 15 }],
		["absent run", () => findCheck({ appId: 42, headSha: HEAD, name: "Coverage" }), null],
	]);
});

github.it(
	"upsert completes only the newest run owned by the app and leaves other checks alone",
	[checksFromSeveralApps],
	function* ({ upsertCheck, checkOnGitHub, checkMutations }) {
		yield* outcomes([
			[
				"completed run",
				() =>
					upsertCheck(
						{
							conclusion: "success",
							detailsUrl: "https://reports.example/coverage",
							headSha: HEAD,
							name: "Coverage",
							output: { summary: "90%", title: "Coverage" },
							status: "completed",
						},
						7,
					),
				{ conclusion: "success", id: 15, status: "completed" },
			],
			["older run", () => checkOnGitHub(11), { status: "queued" }],
			["other app's run", () => checkOnGitHub(99), { status: "queued" }],
			[
				"mutation",
				checkMutations,
				[
					{
						body: {
							conclusion: "success",
							"details_url": "https://reports.example/coverage",
							output: { summary: "90%", title: "Coverage" },
							status: "completed",
						},
						method: "PATCH",
						path: "/repos/acme/widgets/check-runs/15",
					},
				],
			],
		]);
	},
);

github.it(
	"upsert creates a completed check when the app has no matching run",
	[checksFromSeveralApps],
	function* ({ upsertCheck, checkOnGitHub, checkMutations }) {
		yield* outcomes([
			[
				"created run",
				() => upsertCheck({ conclusion: "failure", headSha: HEAD, name: "Coverage", status: "completed" }, 42),
				{ conclusion: "failure", id: 121, status: "completed" },
			],
			["other app's run", () => checkOnGitHub(99), { status: "queued" }],
			[
				"mutation",
				checkMutations,
				[
					{
						body: { conclusion: "failure", "head_sha": HEAD, name: "Coverage", status: "completed" },
						method: "POST",
						path: "/repos/acme/widgets/check-runs",
					},
				],
			],
		]);
	},
);

github.it("a failed lookup does not create a duplicate check", [checkListingRefused], function* ({ upsertCheck, checkMutations }) {
	yield* outcomes([
		[
			"failure",
			() => upsertCheck({ headSha: HEAD, name: "Coverage", status: "queued" }, 7),
			`permission denied at /repos/acme/widgets/commits/${HEAD}/check-runs`,
		],
		["mutations", checkMutations, []],
	]);
});

github.it(
	"creating a completed check without a conclusion fails before sending a request",
	[],
	function* ({ createInvalidCompletedCheck, checkRequests }) {
		yield* outcomes([
			["failure", () => createInvalidCompletedCheck(), "Schema mismatch"],
			["requests", checkRequests, []],
		]);
	},
);

github.it(
	"upserting a completed check without a conclusion fails before even looking up runs",
	[],
	function* ({ createInvalidCompletedCheck, checkRequests }) {
		yield* outcomes([
			["failure", () => createInvalidCompletedCheck("upsert"), "Schema mismatch"],
			["requests", checkRequests, []],
		]);
	},
);

github.it("app ownership excludes newer runs with absent or null app metadata", [checksFromSeveralApps, checkWithoutApp], function* ({ findCheck }) {
	expect(yield* findCheck({ appId: 7, headSha: HEAD, name: "Coverage" })).toMatchObject({ id: 15 });
});
