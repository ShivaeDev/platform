import { expect } from "vitest";
import { application } from "#test/application.ts";
import { generated, realSetup } from "#test/traits.ts";

application.it(
	"lint:skills accepts synced instructions, and app lint checks skills first and rejects an edited managed skill with a sync recovery command",
	[realSetup, generated("my-app", "--no-git")],
	function* ({ editSkill, pnpm, scriptResult }) {
		yield* pnpm("run", "lint:skills");
		expect(yield* scriptResult()).toBe("passed");

		yield* editSkill("story-testing");

		yield* pnpm("run", "lint");
		const result = yield* scriptResult();
		expect(result).toContain("failed with exit 1:");
		expect(result).toContain(".agents/skills/story-testing differs");
		expect(result).toContain("shivaedev-skills sync");
	},
	120_000,
);
