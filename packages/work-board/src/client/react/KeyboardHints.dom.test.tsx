import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";

expectNoReactWarnings();
for (const points of [0, 1]) {
	screenStory.it(
		`shows keyboard help only without touch points when the pointer is fine (${points} touch points)`,
		[
			screenMedia([], points),
			componentScreen(
				<KeyboardHints>
					<kbd>Ctrl K</kbd>
				</KeyboardHints>,
			),
		],
		({ readText }) => {
			expect(readText("kbd")).toBe(points === 0 ? "Ctrl K" : undefined);
		},
	);
}
