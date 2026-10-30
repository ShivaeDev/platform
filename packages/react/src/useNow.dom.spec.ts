import { expect } from "vitest";
import { nowStory } from "#test/nowStory.ts";

nowStory.it("the screen shows the runtime clock's time", [], function* ({ shownTime }) {
	expect(yield* shownTime()).toBe("123000");
});

for (const intervals of [1, 2]) {
	nowStory.it(`after ${intervals} intervals the screen shows the clock's time again`, [], function* ({ intervalsPass, shownTime }) {
		expect(yield* shownTime()).toBe("123000");

		yield* intervalsPass(intervals);

		expect(yield* shownTime()).toBe(String(123_000 + intervals * 1000));
	});
}
