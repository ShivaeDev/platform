import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { readingScreen } from "#test/screenTraits.ts";

for (const kind of ["response", "handoff"]) {
	screenStory.it(
		`restoring a remembered reading keeps focus and the caret in the ${kind} form the reader is typing in`,
		[readingScreen(kind)],
		function* ({ formCaret, rememberReading, restoreRememberedReading, selectPassage, selectText }) {
			yield* selectPassage("p", 0, 8);
			yield* rememberReading();
			yield* selectText("textarea", 4, 9, "backward");

			yield* restoreRememberedReading();

			expect(yield* formCaret()).toEqual({ focused: true, selection: [4, 9, "backward"] });
		},
	);

	screenStory.it(
		`a reading remembered while the reader types in the ${kind} form keeps no passage selection`,
		[readingScreen(kind)],
		function* ({ rememberReading, rememberedSelection, selectPassage, selectText }) {
			yield* selectPassage("p", 0, 8);
			yield* selectText("textarea", 4, 9, "backward");

			yield* rememberReading();

			expect(yield* rememberedSelection()).toBe("none");
		},
	);
}

screenStory.it(
	"a reading remembered while a passage is selected keeps that selection",
	[readingScreen("response")],
	function* ({ rememberReading, rememberedSelection, selectPassage }) {
		yield* selectPassage("p", 0, 8);

		yield* rememberReading();

		expect(yield* rememberedSelection()).toEqual({ from: 0, to: 8 });
	},
);
