import { expect } from "vitest";
import { budgetHeaders } from "#test/budgetHeaders.ts";
import { github } from "#test/github.ts";
import { pullNotAccessible } from "#test/traits.ts";
import { commentWriteRefused } from "#test/writeTraits.ts";

const REPORT = { body: "Coverage: 90%", marker: "coverage" };

for (const [message, outcome] of [
	["Resource not accessible by integration", "permission denied at /repos/acme/widgets/issues/1/comments"],
	["Conversation is locked", "conversation locked at /repos/acme/widgets/issues/1/comments"],
	["This conversation has been locked", "conversation locked at /repos/acme/widgets/issues/1/comments"],
	["Forbidden", "HTTP 403"],
] as const) {
	github.it(`a coverage report GitHub refuses with 403 "${message}" fails as ${outcome}`, [commentWriteRefused(message)], function* ({ postReport }) {
		expect(yield* postReport(REPORT)).toBe(outcome);
	});
}

github.it(
	"a 403 that says Resource not accessible by integration but carries a spent core budget fails as rate limited until the reset",
	[commentWriteRefused("Resource not accessible by integration", budgetHeaders("core", { limit: 5000, remaining: 0, reset: 120 }))],
	function* ({ postReport }) {
		expect(yield* postReport(REPORT)).toBe("rate limited on core until 00:02:00");
	},
);

github.it(
	"a read refused as not accessible by integration fails as permission denied at its path without the query, though the documentation link mentions a rate limit",
	[pullNotAccessible],
	function* ({ readPullWithPrivateQuery }) {
		expect(yield* readPullWithPrivateQuery()).toBe("permission denied at /repos/acme/widgets/pulls/1");
	},
);
