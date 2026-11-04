import { expect } from "vitest";
import { bakery, hasDough, ovenIsLit } from "./bakery.ts";
import { counter, incremented } from "./counter.ts";
import { noteLifetime } from "./lifetimeLog.ts";

counter.it("starts twice in the test Scope", [], function* ({ story }) {
	yield* story.restart([incremented]);
	yield* noteLifetime("body");
});

bakery.it("refuses a mid-story trait at its own line", [ovenIsLit(), hasDough(1)], function* ({ oven, story }) {
	yield* oven.bakesEverything();
	yield* story.apply([hasDough(4)]);
});

bakery.it("reports both engines after a restart", [ovenIsLit(), hasDough(1)], function* ({ oven, story }) {
	yield* oven.bakesEverything();
	const second = yield* story.restart([ovenIsLit(), hasDough(2)]);
	yield* second.oven.bakesEverything();
	expect(second.oven.loaves()).toBe(3);
});
