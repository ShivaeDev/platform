import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";

expectNoReactWarnings();

for (const { points, shown } of [
	{ points: 0, shown: "Ctrl K" },
	{ points: 1, shown: undefined },
]) {
	screenStory.it(
		`keyboard hints ${shown ? "show" : "stay hidden"} with a fine pointer and ${points} touch points`,
		[
			screenMedia([], points),
			componentScreen(
				<KeyboardHints>
					<kbd>Ctrl K</kbd>
				</KeyboardHints>,
			),
		],
		function* ({ keyboardHint }) {
			expect(yield* keyboardHint()).toBe(shown);
		},
	);
}
