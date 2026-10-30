import { fileURLToPath } from "node:url";
import { outcomes } from "#outcomes.ts";
import { storyRunner } from "#test/storyRunner.ts";

const DOM = { environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)) };

storyRunner.it("starts every DOM story without the cookies and storage an earlier story left", [], function* ({ outcome, run }) {
	yield* run("carriedDocumentStories", DOM);

	yield* outcomes({
		"the earlier story": [outcome("Visitor Story: signs in, saves a draft and opens a tab"), "passed"],
		"the later story": [outcome("Visitor Story: starts signed out with no draft and no tab"), "passed"],
	});
});
