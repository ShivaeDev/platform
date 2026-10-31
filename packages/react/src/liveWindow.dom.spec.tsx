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
}
