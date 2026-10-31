import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

const DOM = { environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)) };

for (const [name, failure, narration] of [
	["names a removal that never happens", "The screen did not lose .notice within 30ms.", "wait for .notice to disappear"],
	["names text that never appears", 'The screen has 0 matches for text "Missing message".', 'find text "Missing message"'],
	[
		"names a redirect that never happens",
		'The screen did not navigate to "https://identity.test/authorize" within 30ms.',
		'wait for navigation to "https://identity.test/authorize"',
	],
]) {
	storyRunner.it(`prints a React screen failure that ${name}`, [], function* ({ runStory, outcome }) {
		yield* runStory("screenWaitStories", `Screen Waits Story: ${name}`, DOM);

		const report = yield* outcome();
		expect(report).toContain(failure);
		expect(report).toContain(narration);
		expect(report).toContain("The screen waits when the test failed:");
		expect(report).toContain("Working");
	});
}
