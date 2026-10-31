import { expect } from "vitest";
import { cancellation } from "#test/cancellation.ts";

cancellation.it("interrupting setup stops its running client command", [], function* ({ cancel, commandRunning, start }) {
	yield* start();
	expect(yield* commandRunning()).toBe(true);

	yield* cancel();

	expect(yield* commandRunning()).toBe(false);
});
