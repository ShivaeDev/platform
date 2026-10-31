import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const plan = readingPage({ "home.md": "# Home\n", "notes/plan.md": "# Plan\n\n![Evidence](../shots/review.png)\n" }, "/notes/plan.md");

screenStory.it("inspecting a local image opens the image viewer on that image", [plan], function* ({ imageViewer, inspectImage }) {
	expect(yield* imageViewer()).toBe("closed");

	yield* inspectImage("Evidence");

	expect(yield* imageViewer()).toBe("Evidence · 1 of 1 · /_board/attachment/shots/review.png · notes/plan.md");
});

for (const way of ["Escape", "Close"] as const) {
	screenStory.it(
		`${way} closes the image viewer and returns focus to the image`,
		[plan],
		function* ({ closeViewer, imageViewer, inspectImage, readerFocus }) {
			yield* inspectImage("Evidence");

			yield* closeViewer(way);

			yield* outcomes([
				["focus", () => readerFocus(), "button Inspect image: Evidence"],
				["viewer", () => imageViewer(), "closed"],
			]);
		},
	);
}
