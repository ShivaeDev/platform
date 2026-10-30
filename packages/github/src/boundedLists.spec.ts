import { expect } from "vitest";
import { pullRequests } from "#test/fixtures.ts";
import { github } from "#test/github.ts";
import { pullRequestPageAnswers, repositoryHasPullRequests } from "#test/traits.ts";

for (const [description, reply] of [
	["a number written as text", { body: [{ number: "invalid" }] }],
	["a body over 1 MiB", { chunks: ["x".repeat(1024 * 1024 + 1)] }],
] as const) {
	github.it(
		`a two-page cap returns the first four pull requests as truncated and never reads page 3, which holds ${description}`,
		[repositoryHasPullRequests(5), pullRequestPageAnswers(3, description, reply)],
		function* ({ listPullsBounded }) {
			expect(yield* listPullsBounded(2)).toEqual({ items: pullRequests(1, 2, 3, 4), truncated: true });
		},
	);
}

github.it(
	"a two-page cap over three pull requests that end on page 2 returns all three untruncated",
	[repositoryHasPullRequests(3)],
	function* ({ listPullsBounded }) {
		expect(yield* listPullsBounded(2)).toEqual({ items: pullRequests(1, 2, 3), truncated: false });
	},
);

github.it("a bounded list whose first page exceeds the caller's 10-byte limit fails as too large", [], function* ({ listPullsBounded }) {
	expect(yield* listPullsBounded(2, 10)).toBe("body over 10 bytes");
});
