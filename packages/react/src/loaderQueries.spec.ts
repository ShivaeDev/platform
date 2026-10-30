import { expect } from "vitest";
import { loaderStartedDuringRefresh, loaders, queryWhoseWork, twoLoadersWaiting } from "#test/loaderStories.ts";

loaders.it(
	"a loader started while its query refreshes stays pending instead of returning the retained answer",
	[loaderStartedDuringRefresh()],
	function* ({ outcome }) {
		expect(yield* outcome("second")).toBe("pending");
	},
);

loaders.it(
	"a loader started while its query refreshes resolves with the refreshed answer",
	[loaderStartedDuringRefresh()],
	function* ({ answer, settles }) {
		yield* answer("second");

		expect(yield* settles("second")).toBe("loaded second");
	},
);

loaders.it("aborting a loader rejects it as aborted", [twoLoadersWaiting()], function* ({ abort, settles }) {
	yield* abort("canceled");

	expect(yield* settles("canceled")).toBe("aborted");
});

loaders.it("aborting one of two loaders leaves the other to load the shared answer", [twoLoadersWaiting()], function* ({ abort, answer, settles }) {
	yield* abort("canceled");

	yield* answer("shared");

	expect(yield* settles("remaining")).toBe("loaded shared");
});

loaders.it(
	"a loader whose query dies rejects with the defect rather than a typed error",
	[queryWhoseWork("dies with broken client")],
	function* ({ begin, settles }) {
		yield* begin("broken");

		expect(yield* settles("broken")).toBe("failed: Error: broken client");
	},
);

loaders.it("aborting the only loader interrupts the query's work", [queryWhoseWork("never answers")], function* ({ abort, begin, queryWork }) {
	yield* begin("last");

	yield* abort("last");

	expect(yield* queryWork()).toBe("interrupted");
});
