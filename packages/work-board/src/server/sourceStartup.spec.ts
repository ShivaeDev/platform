import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { sourceCheckout } from "#test/sourceCheckout.ts";

boardStory.it(
	"rebuilds a stale checkout bundle before serving the current browser source",
	[projectFiles({ "plan.md": "# Plan" }), sourceCheckout(), deferredServing],
	function* ({ launchCommand, get }) {
		const command = yield* launchCommand();
		yield* command.listening();
		const script = yield* get("/_board/react.js");
		expect(script.status).toBe(200);
		expect(script.body).toContain("current-checkout-browser");
		expect(script.body).not.toContain("staleBrowserBuild");
	},
);
