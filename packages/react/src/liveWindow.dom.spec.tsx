import { expect } from "vitest";
import { liveWindowScreen } from "#test/liveWindowScreen.tsx";

for (const window of [0, "100 millis"] as const) {
	liveWindowScreen.it(`the session boundary applies a ${window} live coalescing window`, [], function* (test) {
		yield* test.open(window);
		yield* test.observe(() => expect(test.connection()).toBe("1"));
		yield* test.publish(1, { _tag: "Resync" });
		yield* test.observe(() => expect(test.connection()).toBe("2"));
		yield* test.publish(50, { _tag: "Changed", keys: [{ _tag: "List", collection: "notes" }] });
		yield* test.observe(() => expect(test.connection()).toBe(window === 0 ? "52" : "3"));
		expect(test.reads()).toBe(window === 0 ? 52 : 3);
	});
}
