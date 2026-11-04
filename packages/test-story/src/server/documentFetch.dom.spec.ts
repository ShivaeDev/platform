import { expect } from "@effect/vitest";
import { fetchScreen } from "#test/fetchScreen.tsx";

fetchScreen.it("settlement keeps waiting until both outstanding document fetches finish", [], function* ({ load, release, startsSettling, text }) {
	yield* load("first");
	yield* load("second");
	const settling = yield* startsSettling();
	expect(yield* settling.state()).toBe("waiting");

	yield* release("first");

	expect(yield* settling.state()).toBe("waiting");

	yield* release("second");
	yield* settling.finish;

	expect(yield* text()).toBe("second");
});

fetchScreen.it("an aborted document fetch releases settlement and renders cancellation", [], function* ({ cancel, load, settle, text }) {
	yield* load("first");

	yield* cancel();
	yield* settle();

	expect(yield* text()).toBe("Cancelled");
});
