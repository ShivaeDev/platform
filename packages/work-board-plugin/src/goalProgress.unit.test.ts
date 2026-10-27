import { expect, it } from "vitest";
import { goalBarSource } from "#goalProgress.ts";
import { goal } from "#test/summaryFixtures.ts";

it("draws each state's share in its distinct goal color", () => {
	const source = goalBarSource({ ...goal("goal.colors", 1, 2, 10), blocked: 3, parked: 1, scheduled: 3 });
	expect(
		[...source.matchAll(/<rect x="(?<x>[^"]+)" width="(?<width>[^"]+)" height="6" fill="(?<color>[^"]+)"\/>/gu)].map((match) => match.slice(1)),
	).toEqual([
		["0", "10", "#16853f"],
		["10", "20", "#2879da"],
		["30", "30", "#d74253"],
		["60", "30", "#ad7400"],
		["90", "10", "#808080"],
	]);
});
