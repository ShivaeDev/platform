import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { publicationRecoveryStory } from "#test/publication-recovery/story.ts";

publicationRecoveryStory.it(
	"a failed declared-key publication preserves the committed result and reconciles both hosts' socket subscribers",
	[],
	function* ({ errors, initialHints, nextHint, shown, saveWithOversizedKey }) {
		expect(initialHints()).toEqual({ local: ["result"], remote: ["result"] });
		yield* outcomes([
			["initial local read", () => shown("local"), []],
			["initial remote read", () => shown("remote"), []],
		]);

		const saved = yield* saveWithOversizedKey("Saved once");

		expect(saved).toEqual({ title: "Saved once" });
		yield* outcomes([
			["local reconciliation", () => nextHint("local"), "result"],
			["remote reconciliation", () => nextHint("remote"), "result"],
			["local pushed value", () => shown("local"), ["Saved once"]],
			["remote pushed value", () => shown("remote"), ["Saved once"]],
		]);
		expect(errors()).toEqual([expect.stringContaining("Committed command invalidation failed; resynchronizing live streams")]);
	},
);
