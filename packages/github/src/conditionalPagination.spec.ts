import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pullRequests } from "#test/fixtures.ts";
import { github } from "#test/github.ts";
import { repositoryHasPullRequests } from "#test/traits.ts";

github.it(
	"each query page revalidates with its own ETag and returns its own pull requests",
	[repositoryHasPullRequests(5)],
	function* ({ listPulls, pageRevalidations }) {
		expect(yield* listPulls()).toEqual(pullRequests(1, 2, 3, 4, 5));

		const pulls = yield* listPulls();

		yield* outcomes([
			["pull requests", () => Effect.succeed(pulls), pullRequests(1, 2, 3, 4, 5)],
			[
				"page validators",
				() => pageRevalidations(),
				[
					{ etag: "no ETag", page: 1, status: 200 },
					{ etag: "no ETag", page: 2, status: 200 },
					{ etag: "no ETag", page: 3, status: 200 },
					{ etag: '"pulls-1-5"', page: 1, status: 304 },
					{ etag: '"pulls-2-5"', page: 2, status: 304 },
					{ etag: '"pulls-3-5"', page: 3, status: 304 },
				],
			],
		]);
	},
);

github.it(
	"a 304 with a changed next Link lists the new next page instead of the stale page",
	[repositoryHasPullRequests(5)],
	function* ({ changeNextPage, listPulls, pagesRequested }) {
		expect(yield* listPulls()).toEqual(pullRequests(1, 2, 3, 4, 5));
		yield* changeNextPage(1, 3);

		const pulls = yield* listPulls();

		yield* outcomes([
			["pull requests", () => Effect.succeed(pulls), pullRequests(1, 2, 5)],
			["pages requested", () => pagesRequested(), [1, 2, 3, 1, 3]],
		]);
	},
);

github.it(
	"a 304 without a next Link stops the list at the cached first page and reports it untruncated",
	[repositoryHasPullRequests(5)],
	function* ({ changeNextPage, listPullsBounded, pagesRequested }) {
		expect(yield* listPullsBounded(1)).toEqual({ items: pullRequests(1, 2), truncated: true });
		yield* changeNextPage(1, undefined);

		const pulls = yield* listPullsBounded(3);

		yield* outcomes([
			["bounded pull requests", () => Effect.succeed(pulls), { items: pullRequests(1, 2), truncated: false }],
			["pages requested", () => pagesRequested(), [1, 1]],
		]);
	},
);

github.it(
	"a 304 without an ETag keeps the page validator for later revalidation",
	[repositoryHasPullRequests(2)],
	function* ({ listPulls, pageRevalidations }) {
		yield* listPulls();
		yield* listPulls();

		const pulls = yield* listPulls();

		yield* outcomes([
			["pull requests", () => Effect.succeed(pulls), pullRequests(1, 2)],
			[
				"page validators",
				() => pageRevalidations(),
				[
					{ etag: "no ETag", page: 1, status: 200 },
					{ etag: '"pulls-1-2"', page: 1, status: 304 },
					{ etag: '"pulls-1-2"', page: 1, status: 304 },
				],
			],
		]);
	},
);
