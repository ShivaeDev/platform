import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

const DOM = { environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)) };

storyRunner.it("a timed-out find fails only its own story and the next story renders normally", [], function* ({ run, outcome, results }) {
	yield* run("findTimeoutStories", DOM);

	expect(yield* outcome("Screen Waits Story: a missing button times out")).toContain('The screen has 0 matches for button named "Missing".');
	expect(yield* results()).toEqual([
		"Screen Waits Story: a missing button times out []: failed",
		"Screen Waits Story: the next story renders and responds to a click []: passed",
	]);
});
