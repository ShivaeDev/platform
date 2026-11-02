import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { generated, realSetup } from "#test/traits.ts";

const SKILL = ".agents/skills/story-testing/SKILL.md";

for (const flags of [[], ["--minimal"]] as const) {
	const variant = flags.length === 0 ? "full" : "minimal";
	application.it(`a ${variant} app keeps the starter's story-testing selection`, [], function* ({ createApp, skillSelection }) {
		yield* createApp("my-app", ...flags, "--no-git");

		expect(yield* skillSelection()).toEqual(["story-testing"]);
	});

	application.it(
		`a ${variant} app syncs the installed story-testing instructions and links its agent guide to the local copy`,
		[realSetup],
		function* ({ answer, createApp, file, installedSkill }) {
			yield* createApp("my-app", ...flags, "--no-git");

			expect(yield* answer()).toBe("created");
			const shipped = yield* installedSkill("story-testing");
			yield* outcomes([
				["local instructions", () => file(SKILL), shipped],
				["agent guide", () => file("AGENTS.md"), expect.stringContaining(`[story-testing skill](${SKILL})`)],
			]);
		},
		120_000,
	);
}

application.it(
	"app lint accepts synced instructions and rejects an edited managed skill with a sync recovery command",
	[realSetup, generated("my-app", "--no-git")],
	function* ({ editSkill, pnpm, scriptResult }) {
		yield* pnpm("run", "lint");
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
