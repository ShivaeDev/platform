import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";

expectNoReactWarnings();
afterEach(() => vi.unstubAllGlobals());

for (const points of [0, 1]) {
	screenStory.it(`shows keyboard help only without touch points when the pointer is fine (${points} touch points)`, [], function* ({ render }) {
		const match = window.matchMedia.bind(window);
		vi.stubGlobal("navigator", { maxTouchPoints: points });
		vi.stubGlobal("matchMedia", (query: string) => {
			const media = match(query);
			Object.defineProperty(media, "matches", { value: false });
			return media;
		});
		const view = yield* Effect.promise(() =>
			render(
				<KeyboardHints>
					<kbd>Ctrl K</kbd>
				</KeyboardHints>,
			),
		);

		expect(view.container.querySelector("kbd")?.textContent).toBe(points === 0 ? "Ctrl K" : undefined);
	});
}
