import { HttpClientRequest, HttpClientResponse } from "effect/http";
import { expect, it } from "vitest";
import { observeBudget, pollDelay } from "#quota.ts";

it.each([
	{ expected: 60_000, remaining: 5000 },
	{ expected: 120_000, remaining: 2000 },
	{ expected: 300_000, remaining: 900 },
	{ expected: 600_000, remaining: 400 },
])("quota $remaining selects minimum delay $expected", ({ remaining, expected }) => {
	expect(pollDelay({ blockedUntil: 0, limit: 5000, remaining, reset: 1000 }, 60_000, 1, 1000)).toBe(expected);
});
it("pacing spreads requests to reset, and exhausted quota blocks until reset", () => {
	const budget = { blockedUntil: 0, limit: 5000, remaining: 10, reset: 3_600_000 };
	expect(pollDelay(budget, 60_000, 20, 0)).toBe(7_200_000);
	observeBudget(budget, response({ headers: { "x-ratelimit-remaining": "0" }, status: 200 }), 0);
	expect(budget.blockedUntil).toBe(3_600_000);
	expect(pollDelay(budget, 60_000, 1, 0)).toBe(3_600_000);
	const blocked = { blockedUntil: 0, limit: 5000, remaining: 5000, reset: 0 };
	observeBudget(blocked, response({ status: 403 }), 1000);
	expect(blocked.blockedUntil).toBe(61_000);
	observeBudget(blocked, response({ headers: { "retry-after": new Date(121_000).toUTCString() }, status: 429 }), 1000);
	expect(blocked.blockedUntil).toBe(121_000);
});

function response(options: ResponseInit) {
	return HttpClientResponse.fromWeb(HttpClientRequest.get("https://api.github.com"), new Response(null, options));
}
