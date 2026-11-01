import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads } from "#test/github.ts";
import { baselineSaved, failingCheck, failingStatus, githubAnswers, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const incomplete = [
	{ description: "no required-check contexts", nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
	{
		description: "only an unrelated context",
		nodes: [{ __typename: "CheckRun", id: "another-check", isRequired: false }],
		pageInfo: { endCursor: null, hasNextPage: false },
	},
	{ description: "a missing cursor for the next page", nodes: [], pageInfo: { endCursor: null, hasNextPage: true } },
];

for (const { description, nodes, pageInfo } of incomplete) {
	const answer = {
		description,
		reply: { body: { data: { repository: { object: { statusCheckRollup: { contexts: { nodes, pageInfo } } } } } } },
	};
	for (const [kind, failing] of [
		["check run", failingCheck(1, { conclusion: "failure", status: "completed" })],
		["commit status", failingStatus(1)],
	] as const) {
		watch.it(
			`a failed ${kind} with ${description} leaves PR 1 pending until its required flag arrives`,
			[openPr(1), failing, githubAnswers(reads.requiredChecks, answer), watching(1)],
			function* ({ diagnostics, lastPoll, poll, printed, recovers, savedSnapshot }) {
				yield* poll();

				yield* outcomes([
					["poll", () => lastPoll(), "polled"],
					["diagnostics", () => diagnostics(), []],
					["printed", () => printed(), []],
					["saved snapshot of PR 1", () => savedSnapshot(1), "none"],
				]);

				yield* recovers(reads.requiredChecks);
				yield* poll();

				yield* outcomes([
					["printed", () => printed(), ["PR 1 checks-failed", "PR 1 stuck"]],
					["saved snapshot of PR 1", () => savedSnapshot(1), "open, auto-merge, failing checks"],
				]);
			},
		);
	}
}

watch.it(
	"missing required-check metadata keeps PR 1's last failing snapshot instead of clearing its failure",
	[openPr(1), watching(1), baselineSaved],
	function* ({ answers, checkConcludes, poll, printed, savedSnapshot }) {
		yield* checkConcludes(1, { conclusion: "failure", status: "completed" });
		yield* poll();
		yield* answers(reads.requiredChecks, {
			description: "no contexts",
			reply: {
				body: {
					data: { repository: { object: { statusCheckRollup: { contexts: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } } } } },
				},
			},
		});

		yield* poll();

		yield* outcomes([
			["printed", () => printed(), ["PR 1 checks-failed", "PR 1 stuck"]],
			["saved snapshot of PR 1", () => savedSnapshot(1), "open, auto-merge, failing checks"],
		]);
	},
);

for (const isRequired of [true, false]) {
	const contexts = {
		nodes: [{ __typename: "StatusContext", context: "ci", isRequired }],
		pageInfo: { endCursor: null, hasNextPage: false },
	};
	const answer = {
		description: `only the ${isRequired ? "required" : "optional"} failing commit status`,
		reply: { body: { data: { repository: { object: { statusCheckRollup: { contexts } } } } } },
	};
	watch.it(
		`a known ${isRequired ? "required" : "optional"} failure with another missing flag ${isRequired ? "reports PR 1 failing" : "leaves PR 1 pending"}`,
		[
			openPr(1),
			failingCheck(1, { conclusion: "failure", status: "completed" }),
			failingStatus(1),
			githubAnswers(reads.requiredChecks, answer),
			watching(1),
		],
		function* ({ poll, printed, savedSnapshot }) {
			yield* poll();

			yield* outcomes([
				["printed", () => printed(), isRequired ? ["PR 1 checks-failed", "PR 1 stuck"] : []],
				["saved snapshot of PR 1", () => savedSnapshot(1), isRequired ? "open, auto-merge, failing checks" : "none"],
			]);
		},
	);
}
