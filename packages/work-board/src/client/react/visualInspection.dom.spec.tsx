import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"home.md": "# Home\n",
	"notes/plan.md": "# Plan\n\n![Evidence](../shots/review.png)\n",
};

screenStory.it(
	"inspects a local image in a dialog that Escape and Close dismiss back to the image",
	[chromeScreen(files)],
	function* ({ keyboard, readFocus, roles }) {
		const image = { name: "Inspect image: Evidence", role: "button" } as const;
		const viewer = { name: "Visual evidence", role: "dialog" } as const;
		yield* eventually(() => expect(() => roles.text(image)).not.toThrow());
		expect(() => roles.text(viewer)).toThrow(/has 0 matches/u);
		yield* roles.click(image);
		yield* eventually(() => expect(roles.text(viewer)).toContain("Evidence · 1 of 1"));
		keyboard("Escape");
		yield* eventually(() => expect(() => roles.text(viewer)).toThrow(/has 0 matches/u));
		yield* eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual(image));
		yield* roles.click(image);
		yield* eventually(() => expect(() => roles.text(viewer)).not.toThrow());
		yield* roles.click({ name: "Close", role: "button" });
		yield* eventually(() => expect(() => roles.text(viewer)).toThrow(/has 0 matches/u));
		yield* eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual(image));
	},
);
