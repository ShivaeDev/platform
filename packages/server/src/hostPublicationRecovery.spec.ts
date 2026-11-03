import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { publicationRecoveryStory } from "#test/publication-recovery/story.ts";

publicationRecoveryStory.it(
	"a failed declared-key publication preserves the committed result and reconciles both hosts' socket subscribers",
	[],
	function* ({ errors, initialHints, nextHint, read, saveWithOversizedKey }) {
		expect(initialHints()).toEqual({ local: ["resync"], remote: ["resync"] });
		yield* outcomes([
			["initial local read", () => read("local"), []],
			["initial remote read", () => read("remote"), []],
		]);

		const saved = yield* saveWithOversizedKey("Saved once");

		expect(saved).toEqual({ title: "Saved once" });
		yield* outcomes([
			["local reconciliation", () => nextHint("local"), "resync"],
			["remote reconciliation", () => nextHint("remote"), "resync"],
			["local authoritative read", () => read("local"), ["Saved once"]],
			["remote authoritative read", () => read("remote"), ["Saved once"]],
		]);
		expect(errors()).toEqual([expect.stringContaining("Committed command invalidation failed; resynchronizing live streams")]);
	},
);
