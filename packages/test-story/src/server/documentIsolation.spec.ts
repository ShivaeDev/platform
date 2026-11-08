import { outcomes } from "#server/outcomes.ts";
import { domEnvironment } from "#test/domEnvironment.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("starts every DOM story without the cookies and storage an earlier story left", [], function* ({ outcome, run }) {
	yield* run("carriedDocumentStories", domEnvironment);

	yield* outcomes([
		["the earlier story", () => outcome("Visitor Story: signs in, saves a draft and opens a tab"), "passed"],
		["the later story", () => outcome("Visitor Story: starts signed out with no draft and no tab"), "passed"],
	]);
});
