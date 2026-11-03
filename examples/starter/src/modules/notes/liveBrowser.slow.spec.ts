import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveBrowser } from "#modules/notes/test-support/liveBrowser.ts";

liveBrowser.it(
	"alice's live check follows the second-tab hint through reread and render without navigation, signs out both tabs and captures both screens",
	[],
	function* ({ check, outcome, screenshots }) {
		yield* check();

		yield* outcomes([
			["hint, reread, render and sign-out checks", () => outcome(), "passed"],
			["screenshots", () => screenshots(), ["live-notes.png: PNG image", "signed-out.png: PNG image"]],
		]);
	},
	120_000,
);
