import { expect, it } from "vitest";
import { pollDelay } from "#quota.ts";

it.each([
	{ expected: 60_000, remaining: 5000 },
	{ expected: 120_000, remaining: 2000 },
	{ expected: 300_000, remaining: 900 },
	{ expected: 600_000, remaining: 400 },
])("quota $remaining selects minimum delay $expected", ({ remaining, expected }) => {
	expect(pollDelay({ blockedUntil: 0, limit: 5000, remaining, reset: 1000 }, 60_000, 1, 1000)).toBe(expected);
});
it("pacing spreads requests to reset", () => {
	const budget = { blockedUntil: 0, limit: 5000, remaining: 10, reset: 3_600_000 };
	expect(pollDelay(budget, 60_000, 20, 0)).toBe(7_200_000);
});
