import { expect } from "vitest";
import { loaderOwner, loaders } from "#test/loaderStories.ts";

loaders.it(
	"waits for a refresh instead of returning retained success",
	[loaderOwner("mounted")],
	function* ({ begin, complete, value, refresh, settled, wait }) {
		begin("first");
		yield* complete("first");
		expect(yield* value("first")).toBe("first");
		refresh();
		begin("second");
		yield* wait();
		expect(settled("second")).toBe(false);
		yield* complete("second");
		expect(yield* value("second")).toBe("second");
	},
);
loaders.it(
	"aborting a loader releases its subscription without interrupting another reader",
	[loaderOwner("shared")],
	function* ({ begin, abort, aborted, complete, value }) {
		begin("canceled");
		begin("remaining");
		abort("canceled");
		yield* aborted("canceled");
		yield* complete("shared");
		expect(yield* value("remaining")).toBe("shared");
	},
);
loaders.it("defects remain failures instead of typed RPC errors", [loaderOwner("defect")], function* ({ begin, broken }) {
	begin("broken");
	yield* broken("broken");
});
loaders.it(
	"aborting the last reader lets native work interrupt",
	[loaderOwner("interrupt")],
	function* ({ begin, abort, aborted, observe, interrupted }) {
		begin("last");
		abort("last");
		yield* aborted("last");
		yield* observe("native query work was interrupted", () => expect(interrupted()).toBe(true));
	},
);
