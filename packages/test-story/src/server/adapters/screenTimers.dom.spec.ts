import { expect } from "vitest";
import { timerScreen } from "#test/timerScreen.tsx";

timerScreen.it("typing then settling renders the debounced food search", [], function* ({ enter, settle, results }) {
	expect(yield* results()).toBe("All foods");

	yield* enter("input", "pear");
	yield* settle();

	expect(yield* results()).toBe("Results for pear");
});

timerScreen.it("the controlled clock selects a diary row after a long press", [], function* ({ beginPress, timePasses, row }) {
	expect(yield* row()).toBe("Diary row");

	yield* beginPress();
	yield* timePasses(450);

	expect(yield* row()).toBe("Selected diary row");
});
