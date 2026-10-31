import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingScreenFinalizer, latestScreenClosedEarly, screenScopeStory, screensOpen } from "#test/screenScopeStory.ts";

const SCREENS = 3;
const DRAFTED = { controls: [{ name: "answer", value: "Use local files" }], storage: { draft: "Use local files" }, text: "Direction" };

for (const [how, given, ending, open] of [
	["passes", [], "passed", SCREENS],
	["fails", [], "failed", SCREENS],
	["fails after the latest screen already closed", [latestScreenClosedEarly()], "failed", SCREENS - 1],
	["passes but a later finalizer fails", [failingScreenFinalizer()], "passed", SCREENS],
] as const) {
	screenScopeStory.it(
		`when a story ${how}, every screen leaves the document and the latest one stays readable`,
		[screensOpen(SCREENS), ...given],
		function* ({ connectedScreens, endScope, retainedView }) {
			expect(yield* connectedScreens()).toBe(open);

			yield* endScope(ending);

			yield* outcomes({ connected: [connectedScreens(), 0], view: [retainedView(), DRAFTED] });
		},
	);
}

for (const ending of ["passed", "failed"] as const) {
	screenScopeStory.it(
		`when a story with a live session ${ending}, the browser gets its own fetch back`,
		[],
		function* ({ endScope, openSession, transport }) {
			yield* openSession();
			expect(yield* transport()).toBe("the session transport");

			yield* endScope(ending);

			expect(yield* transport()).toBe("the browser's own fetch");
		},
	);
}
