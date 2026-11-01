import { expect } from "vitest";
import { liveWindowScreen } from "#test/liveWindowScreen.tsx";

for (const window of [0, "100 millis"] as const) {
	liveWindowScreen.it(
		`a session boundary given a ${window} live coalescing window hands it to the client's live binding`,
		[],
		function* ({ bindingWindow, open }) {
			yield* open(window);

			expect(yield* bindingWindow()).toBe(window);
		},
	);

	liveWindowScreen.it(
		`clearing a session's ${window} live window restores the binding's original window`,
		[],
		function* ({ bindingWindow, changeWindow, open }) {
			yield* open(window);
			expect(yield* bindingWindow()).toBe(window);

			yield* changeWindow(undefined);

			expect(yield* bindingWindow()).toBe("75 millis");
		},
	);
}
