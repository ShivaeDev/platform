import { expect } from "vitest";
import { biomeStory } from "#test/biomeStory.ts";

biomeStory.it(
	"Biome's recommended preset lists suspicious/noDebugger, which it enables, and not style/useBlockStatements, which it leaves off",
	[],
	function* ({ listsRecommendedRules }) {
		const rules = yield* listsRecommendedRules();

		expect(rules.filter((rule) => rule === "suspicious/noDebugger" || rule === "style/useBlockStatements")).toEqual(["suspicious/noDebugger"]);
	},
);
