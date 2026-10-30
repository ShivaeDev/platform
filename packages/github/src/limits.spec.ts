import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { github } from "#test/github.ts";
import {
	bareTooManyRequests,
	clockReadsTenSeconds,
	coreBudget,
	coreSpentWithoutRetryAfter,
	coreSpentWithRetryAfter,
	searchBudgetSpentUntil,
	secondaryLimit,
	secondaryLimitWithoutRetryAfter,
	secondaryLimitWithoutRetryAfterEveryTime,
} from "#test/traits.ts";

const PULL_REQUEST = { number: 1, title: "Pull request 1" };
const SEARCH_LIMITED = { path: "/search/issues", remaining: 0, resource: "search", retryAt: "1970-01-01T00:02:00.000Z" };

github.it(
	"a search GitHub refuses with a spent search budget fails as rate limited on search until the reset at 00:02:00",
	[searchBudgetSpentUntil(120)],
	function* ({ search }) {
		expect(yield* search()).toBe("rate limited on search until 00:02:00");
	},
);

github.it("a second search before 00:02:00 fails the same way", [searchBudgetSpentUntil(120)], function* ({ search }) {
	yield* search();

	expect(yield* search()).toBe("rate limited on search until 00:02:00");
});

github.it("a second search before 00:02:00 never reaches GitHub", [searchBudgetSpentUntil(120)], function* ({ requests, search }) {
	yield* search();
	expect(yield* requests()).toEqual(["GET /search/issues?q=private-query-secret 403"]);

	yield* search();

	expect(yield* requests()).toEqual(["GET /search/issues?q=private-query-secret 403"]);
});

github.it("with the search budget spent, pull request 1 still reads from GitHub", [searchBudgetSpentUntil(120)], function* ({ readPull, search }) {
	yield* search();

	expect(yield* readPull()).toEqual(PULL_REQUEST);
});

github.it(
	"once 00:02:00 passes, the next search reaches GitHub again and returns its result",
	[searchBudgetSpentUntil(120)],
	function* ({ search, timePasses }) {
		yield* search();
		expect(yield* search()).toBe("rate limited on search until 00:02:00");

		yield* timePasses("2 minutes");

		expect(yield* search()).toEqual({ totalCount: 3 });
	},
);

github.it("a refused search records the spent search budget GitHub reported", [searchBudgetSpentUntil(120)], function* ({ observations, search }) {
	yield* search();

	expect(yield* observations()).toEqual([{ limit: 30, remaining: 0, reset: "00:02:00", resource: "search", used: 30 }]);
});

for (const status of [403, 429]) {
	github.it(
		`at 00:00:10, a ${status} secondary rate limit with Retry-After: 30 fails as rate limited on core until 00:00:40`,
		[clockReadsTenSeconds, secondaryLimit(status, 30)],
		function* ({ readPull }) {
			expect(yield* readPull()).toBe("rate limited on core until 00:00:40");
		},
	);
}

github.it(
	"29 seconds into a 30-second Retry-After, a read still never reaches GitHub",
	[secondaryLimit(403, 30)],
	function* ({ readPull, requests, timePasses }) {
		yield* readPull();
		yield* timePasses("29 seconds");
		expect(yield* requests()).toEqual(["GET /repos/acme/widgets/pulls/1 403"]);

		yield* readPull();

		expect(yield* requests()).toEqual(["GET /repos/acme/widgets/pulls/1 403"]);
	},
);

github.it(
	"once a 30-second Retry-After has passed, a read reaches GitHub and returns pull request 1",
	[secondaryLimit(403, 30)],
	function* ({ readPull, timePasses }) {
		yield* readPull();
		expect(yield* readPull()).toBe("rate limited on core until 00:00:30");

		yield* timePasses("30 seconds");

		expect(yield* readPull()).toEqual(PULL_REQUEST);
	},
);

github.it(
	"a 403 whose message names a secondary rate limit, without Retry-After, fails as rate limited on core for one minute",
	[secondaryLimitWithoutRetryAfter],
	function* ({ readPull }) {
		expect(yield* readPull()).toBe("rate limited on core until 00:01:00");
	},
);

github.it(
	"a second message-only secondary limit in a row backs off for two minutes",
	[secondaryLimitWithoutRetryAfterEveryTime],
	function* ({ readPull, timePasses }) {
		expect(yield* readPull()).toBe("rate limited on core until 00:01:00");
		yield* timePasses("1 minute");

		const second = yield* readPull();

		expect(second).toBe("rate limited on core until 00:03:00");
	},
);

github.it(
	"a successful read between two message-only secondary limits brings the backoff back to one minute",
	[secondaryLimitWithoutRetryAfter],
	function* ({ readPull, secondaryLimitStrikesAgain, timePasses }) {
		expect(yield* readPull()).toBe("rate limited on core until 00:01:00");
		yield* timePasses("1 minute");
		expect(yield* readPull()).toEqual(PULL_REQUEST);
		yield* secondaryLimitStrikesAgain();

		const next = yield* readPull();

		expect(next).toBe("rate limited on core until 00:02:00");
	},
);

github.it(
	"a 429 with core budget left and no Retry-After fails as rate limited on core for one minute",
	[bareTooManyRequests],
	function* ({ readPull }) {
		expect(yield* readPull()).toBe("rate limited on core until 00:01:00");
	},
);

github.it("a 429's Retry-After: 120 takes precedence over its spent budget's reset at 00:15:00", [coreSpentWithRetryAfter], function* ({ readPull }) {
	expect(yield* readPull()).toBe("rate limited on core until 00:02:00");
});

github.it(
	"a 429 with a spent core budget and no Retry-After fails as rate limited until the reset at 00:02:00",
	[coreSpentWithoutRetryAfter],
	function* ({ readPull }) {
		expect(yield* readPull()).toBe("rate limited on core until 00:02:00");
	},
);

github.it(
	"a read GitHub answers with 304 Not Modified records the core budget sent with it",
	[coreBudget(2, 120)],
	function* ({ coreBudgetSpentElsewhere, observations, readPull }) {
		yield* readPull();
		expect(yield* observations()).toEqual([{ limit: 5000, remaining: 2, reset: "00:02:00", resource: "core", used: 4998 }]);
		yield* coreBudgetSpentElsewhere(1, 200);

		yield* readPull();

		expect(yield* observations()).toEqual([{ limit: 5000, remaining: 1, reset: "00:03:20", resource: "core", used: 4999 }]);
	},
);

github.it("a search records the search budget beside the core budget", [coreBudget(2, 120)], function* ({ observations, readPull, search }) {
	yield* readPull();

	yield* search();

	expect(yield* observations()).toEqual([
		{ limit: 5000, remaining: 2, reset: "00:02:00", resource: "core", used: 4998 },
		{ limit: 30, remaining: 30, reset: "00:01:00", resource: "search", used: 0 },
	]);
});

github.it(
	"a refused search logs a GitHub rate limited warning with its path without the query, the remaining budget, the resource and the retry time",
	[searchBudgetSpentUntil(120)],
	function* ({ rateLimitLogs, search }) {
		yield* search();

		expect(yield* rateLimitLogs()).toEqual([SEARCH_LIMITED]);
	},
);

github.it(
	"a refused search adds a GitHub.rateLimited event with the same fields to the caller's span",
	[searchBudgetSpentUntil(120)],
	function* ({ rateLimitEvents, search }) {
		yield* search();

		expect(yield* rateLimitEvents()).toEqual([SEARCH_LIMITED]);
	},
);

github.it(
	"a search the client blocks before 00:02:00 logs the warning and adds the span event again",
	[searchBudgetSpentUntil(120)],
	function* ({ rateLimitEvents, rateLimitLogs, search }) {
		yield* search();
		yield* outcomes({
			"rate-limit events": [rateLimitEvents(), [SEARCH_LIMITED]],
			"rate-limit warnings": [rateLimitLogs(), [SEARCH_LIMITED]],
		});

		yield* search();

		yield* outcomes({
			"rate-limit events": [rateLimitEvents(), [SEARCH_LIMITED, SEARCH_LIMITED]],
			"rate-limit warnings": [rateLimitLogs(), [SEARCH_LIMITED, SEARCH_LIMITED]],
		});
	},
);

github.it(
	"a refused and then blocked search log and trace both refusals but keep the configured token out of failures, logs and spans and the private query out of failures, logs and span events",
	[searchBudgetSpentUntil(120)],
	function* ({ privateQuerySeenIn, rateLimitEvents, rateLimitLogs, search, tokenSeenIn }) {
		yield* search();

		yield* search();

		yield* outcomes({
			"private query seen in": [privateQuerySeenIn(), []],
			"rate-limit events": [rateLimitEvents(), [SEARCH_LIMITED, SEARCH_LIMITED]],
			"rate-limit warnings": [rateLimitLogs(), [SEARCH_LIMITED, SEARCH_LIMITED]],
			"token seen in": [tokenSeenIn(), []],
		});
	},
);

github.it("before any answer, the client counts a search path against search and every other path against core", [], function* ({ resourceOf }) {
	yield* outcomes({
		"/repos/acme/widgets/pulls/1": [resourceOf("/repos/acme/widgets/pulls/1"), "core"],
		"/search/issues": [resourceOf("/search/issues"), "search"],
	});
});

github.it(
	"once GitHub names a path's budget code_search, the client counts that path against code_search",
	[],
	function* ({ resourceOf, searchCode }) {
		expect(yield* resourceOf("/search/code")).toBe("search");

		yield* searchCode();

		expect(yield* resourceOf("/search/code")).toBe("code_search");
	},
);
