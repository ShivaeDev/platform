import { Effect } from "effect";
import { expect } from "vitest";
import { ResponseBodyTooLarge } from "@shivaedev/http/errors.ts";
import { github } from "#test/github.ts";
import { pullRequestPageAnswers, repositoryListsPullRequests } from "#test/traits.ts";

for (const [name, reply] of [
	["malformed", { body: [{ number: "invalid" }] }],
	["oversized", { chunks: ["x".repeat(1024 * 1024 + 1)] }],
] as const) {
	github.it(
		`returns the capped prefix without requesting the ${name} page beyond the cap`,
		[repositoryListsPullRequests(5), pullRequestPageAnswers(3, reply)],
		function* ({ readPullsBounded, requests }) {
			const result = yield* readPullsBounded(2);
			expect(result).toEqual({
				items: [1, 2, 3, 4].map((number) => ({ number, title: `Pull request ${number}` })),
				truncated: true,
			});
			expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls", "/repos/acme/widgets/pulls?page=2"]);
		},
	);
}

for (const pageCap of [2, 3]) {
	github.it(
		`reports an untruncated list ending at page two with cap ${pageCap}`,
		[repositoryListsPullRequests(3)],
		function* ({ readPullsBounded, requests }) {
			expect(yield* readPullsBounded(pageCap)).toEqual({
				items: [1, 2, 3].map((number) => ({ number, title: `Pull request ${number}` })),
				truncated: false,
			});
			expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls", "/repos/acme/widgets/pulls?page=2"]);
		},
	);
}

github.it("bounded lists enforce the caller's byte limit on fetched pages", [], function* ({ readPullsBounded, requests }) {
	expect(yield* Effect.flip(readPullsBounded(2, 10))).toEqual(new ResponseBodyTooLarge({ limit: 10 }));
	expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls"]);
});
