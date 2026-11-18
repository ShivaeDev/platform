import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bootPage, savedChoice, storageBlocked, systemPrefers } from "#test-support/bootPage.ts";

const visits = [
	["a saved dark choice under a light system", [savedChoice("dark"), systemPrefers("light")], "dark"],
	["a saved light choice under a dark system", [savedChoice("light"), systemPrefers("dark")], "light"],
	["no saved choice under a dark system", [systemPrefers("dark")], "dark"],
	["no saved choice under a light system", [systemPrefers("light")], "light"],
	["an unknown saved choice under a dark system", [savedChoice("sepia"), systemPrefers("dark")], "dark"],
	["blocked storage under a dark system", [storageBlocked, systemPrefers("dark")], "dark"],
] as const;

for (const [visit, given, appearance] of visits) {
	bootPage.it(
		`with ${visit}, the page's inline script marks the document ${appearance} before the bundle runs, and the started app leaves those marks unchanged`,
		given,
		function* ({ bundleRuns, documentMarks, pageLoads }) {
			yield* pageLoads();
			expect(yield* documentMarks()).toEqual(['lang="en"', `class="${appearance}"`]);

			yield* bundleRuns();

			expect(yield* documentMarks()).toEqual(['lang="en"', `class="${appearance}"`]);
		},
	);
}

bootPage.it(
	"the page shows its outline in the root until the started app's first render replaces it",
	[],
	function* ({ bundleRuns, outline, pageLoads, themeControl }) {
		yield* pageLoads();
		expect(yield* outline()).toBe("shown");

		yield* bundleRuns();

		yield* outcomes([
			["outline", () => outline(), "gone"],
			["theme control", () => themeControl(), "shown"],
		]);
	},
);
