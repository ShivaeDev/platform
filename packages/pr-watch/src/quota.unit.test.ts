import { DateTime } from "effect";
import { expect, it } from "vitest";
import { pollDelay } from "#quota.ts";

it.each([
	{ expected: 60_000, remaining: 5000 },
	{ expected: 120_000, remaining: 2000 },
	{ expected: 300_000, remaining: 900 },
	{ expected: 600_000, remaining: 400 },
])("quota $remaining selects minimum delay $expected", ({ remaining, expected }) => {
	expect(pollDelay([{ limit: 5000, remaining, reset: DateTime.makeUnsafe(1000), resource: "core", used: 5000 - remaining }], 60_000, 1, 1000)).toBe(
		expected,
	);
});
it("pacing spreads requests to reset", () => {
	const budget = { limit: 5000, remaining: 10, reset: DateTime.makeUnsafe(3_600_000), resource: "core", used: 4990 };
	expect(pollDelay([budget], 60_000, 20, 0)).toBe(7_200_000);
});

it("a retry instant defers the next poll even without a budget observation", () => {
	expect(pollDelay([], 1000, 1, 10_000, 120_000)).toBe(110_000);
});
it("the slowest resource determines pacing", () => {
	const core = { limit: 5000, remaining: 5000, reset: DateTime.makeUnsafe(3_600_000), resource: "core", used: 0 };
	const graphql = { ...core, remaining: 0, resource: "graphql", used: 5000 };
	expect(pollDelay([core, graphql], 60_000, 1, 1000)).toBe(3_599_000);
});
