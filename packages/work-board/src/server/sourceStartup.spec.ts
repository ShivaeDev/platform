import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { sourceCheckout } from "#test/sourceCheckout.ts";

boardStory.it(
	"started from a checkout with a stale browser bundle, the board rebuilds it and serves the current source",
	[projectFiles({ "plan.md": "# Plan" }), sourceCheckout(), deferredServing],
	function* ({ commandAddress, commandStarts, scriptBuild }) {
		yield* commandStarts();

		yield* outcomes({
			"the address": [commandAddress(), "a loopback address"],
			"the build": [scriptBuild(), "the current checkout's build"],
		});
	},
);
