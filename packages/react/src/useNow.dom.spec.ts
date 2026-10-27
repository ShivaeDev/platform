import { expect } from "vitest";
import { nowStory } from "#test/nowStory.ts";

nowStory.it("renders the runtime clock and reads it again on the interval", [], function* ({ advance, time }) {
	expect(time()).toBe("123000");
	yield* advance(1000);
	expect(time()).toBe("124000");
	yield* advance(1000);
	expect(time()).toBe("125000");
});
