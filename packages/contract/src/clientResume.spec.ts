import { expect } from "vitest";
import { clientResumeStory, watching } from "#test/clientResumeStory.ts";

for (const source of ["native", "online", "visibilitychange"] as const) {
	clientResumeStory.it(
		`${source}: makeClient resumes its pushed subscription and refreshes both queries`,
		[watching],
		function* ({ changeQuietly, resume, shown, subscriptionsOpened, untilRefreshed }) {
			expect(yield* shown()).toEqual(["default: First", "default: First"]);
			expect(subscriptionsOpened()).toBe("2 streams opened");
			changeQuietly("Changed while away");
			expect(yield* shown()).toEqual(["default: First", "default: First"]);

			resume(source);
			yield* untilRefreshed();

			expect(yield* shown()).toEqual(["default: Changed while away", "default: Changed while away"]);
			expect(subscriptionsOpened()).toBe("3 streams opened");
		},
	);
}

clientResumeStory.it("disposing makeClient's registry releases both resume sources", [watching], function* ({ dispose, listeners }) {
	expect(yield* listeners()).toEqual({ browser: 6, native: 2 });

	dispose();

	expect(yield* listeners()).toEqual({ browser: 0, native: 0 });
});
