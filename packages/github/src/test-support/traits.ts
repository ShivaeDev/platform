import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { type Budget, budgetHeaders } from "./budgetHeaders.ts";
import { SECONDARY_LIMIT } from "./fakeRepository.ts";
import { github } from "./github.ts";

function clock(seconds: number) {
	return new Date(seconds * 1000).toISOString().slice(11, 19);
}

function core(budget: Partial<Budget>) {
	return budgetHeaders("core", { limit: 5000, remaining: 4990, reset: 3600, ...budget });
}

function pullAnswers(description: string, reply: FakeHttpReply) {
	return github.trait("github", `GitHub answers pull request 1 ${description}`, function* ({ server }) {
		yield* server.scriptFault("pull", { kind: "status", reply });
	});
}

export function repositoryHasPullRequests(count: number) {
	return github.trait("github", `the repository has ${count} pull requests, listed two to a page`, ({ state }) => {
		state.pullRequests = count;
	});
}

export function pullRequestPageAnswers(page: number, description: string, reply: FakeHttpReply) {
	return github.trait("github", `GitHub answers pull request page ${page} with ${description}`, ({ state }) => {
		state.pageReplies.set(page, reply);
	});
}

export function coreBudget(remaining: number, reset: number) {
	return github.trait("github", `the core budget has ${remaining} of 5000 requests left until ${clock(reset)}`, ({ state }) => {
		state.budgets.core = { limit: 5000, remaining, reset };
	});
}

export function searchBudgetSpentUntil(reset: number) {
	return github.trait("github", `the search budget is spent until ${clock(reset)}`, ({ state }) => {
		state.budgets.search = { limit: 30, remaining: 0, reset };
	});
}

export const clockReadsTenSeconds = github.trait("github", "the clock reads 00:00:10", function* () {
	yield* TestClock.adjust("10 seconds");
});

export const pullMissing = pullAnswers("with 404 Not Found", { body: { message: "Not Found" }, status: HttpStatus.fromLiteral("NotFound") });

export const tokenRejected = pullAnswers("with 401 Bad credentials", {
	body: { message: "Bad credentials" },
	status: HttpStatus.fromLiteral("Unauthorized"),
});

export const pullBreaksSchema = pullAnswers('with a number written as "one"', { body: { number: "one", title: "Pull request 1" } });

export const pullNotAccessible = pullAnswers(
	'with 403 "Resource not accessible by integration" and a documentation link that mentions a rate limit',
	{
		body: { "documentation_url": "https://docs.github.com/rest#rate limit", message: "Resource not accessible by integration" },
		status: HttpStatus.fromLiteral("Forbidden"),
	},
);

export function secondaryLimit(status: number, retryAfter: number) {
	return pullAnswers(`once with ${status}, a secondary rate limit, Retry-After: ${retryAfter} and core budget left`, {
		body: { message: SECONDARY_LIMIT },
		headers: { ...core({ remaining: 40, reset: 900 }), "Retry-After": String(retryAfter) },
		status,
	});
}

const messageOnlyLimit = {
	body: { message: SECONDARY_LIMIT },
	headers: core({ remaining: 40, reset: 3600 }),
	status: HttpStatus.fromLiteral("Forbidden"),
};

export const secondaryLimitWithoutRetryAfter = pullAnswers(
	"once with 403, a secondary rate limit in its message and no Retry-After",
	messageOnlyLimit,
);

export const secondaryLimitWithoutRetryAfterEveryTime = github.trait(
	"github",
	"GitHub answers every read of pull request 1 with 403, a secondary rate limit in its message and no Retry-After",
	function* ({ server }) {
		yield* server.scriptFault("pull", { kind: "status", reply: messageOnlyLimit }, { repeat: true });
	},
);

export const bareTooManyRequests = pullAnswers("once with 429, core budget left and no Retry-After", {
	body: { message: SECONDARY_LIMIT },
	headers: core({ remaining: 40, reset: 3600 }),
	status: HttpStatus.fromLiteral("TooManyRequests"),
});

export const coreSpentWithoutRetryAfter = pullAnswers("with 429, a spent core budget that resets at 00:02:00 and no Retry-After", {
	body: { message: "API rate limit exceeded for user ID 1." },
	headers: core({ remaining: 0, reset: 120 }),
	status: HttpStatus.fromLiteral("TooManyRequests"),
});

export const coreSpentWithRetryAfter = pullAnswers("with 429, a spent core budget that resets at 00:15:00 and Retry-After: 120", {
	body: { message: "API rate limit exceeded for user ID 1." },
	headers: { ...core({ remaining: 0, reset: 900 }), "Retry-After": "120" },
	status: HttpStatus.fromLiteral("TooManyRequests"),
});

export const connectionResetsMidBody = github.trait(
	"github",
	"GitHub resets the connection after the first body chunk of pull request 1",
	function* ({ server }) {
		yield* server.scriptFault("pull", { kind: "reset" });
	},
);

export const connectionDrops = github.trait("github", "GitHub drops every connection for pull request 1", function* ({ server }) {
	yield* server.scriptFault("pull", { kind: "drop" }, { repeat: true });
});
