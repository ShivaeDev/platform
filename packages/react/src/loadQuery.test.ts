import { Effect } from "effect";
import { expect } from "vitest";
import { loaderOwner, loaders } from "#test/loaderStories.ts";

loaders.it(
	"waits for a refresh instead of returning retained success",
	[loaderOwner("mounted")],
	function* ({ begin, complete, pending, refresh, awaitRefresh }) {
		begin("first");
		yield* complete("first");
		expect(yield* Effect.promise(() => pending("first").promise)).toBe("first");
		refresh();
		begin("second");
		let settled = false;
		pending("second").promise.then(() => {
			settled = true;
		});
		yield* awaitRefresh();
		expect(settled).toBe(false);
		yield* complete("second");
		expect(yield* Effect.promise(() => pending("second").promise)).toBe("second");
	},
);
loaders.it(
	"aborting a loader releases its subscription without interrupting another reader",
	[loaderOwner("shared")],
	function* ({ begin, abort, pending, complete }) {
		begin("canceled");
		begin("remaining");
		abort("canceled");
		yield* Effect.promise(() => expect(pending("canceled").promise).rejects.toMatchObject({ name: "AbortError" }));
		yield* complete("shared");
		expect(yield* Effect.promise(() => pending("remaining").promise)).toBe("shared");
	},
);
const defect = new Error("broken client");
loaders.it("defects remain failures instead of typed RPC errors", [loaderOwner("defect", defect)], function* ({ begin, pending }) {
	begin("broken");
	yield* Effect.promise(() => expect(pending("broken").promise).rejects.toThrow(defect));
});
loaders.it(
	"aborting the last reader lets native work interrupt",
	[loaderOwner("interrupt")],
	function* ({ begin, abort, pending, observe, interrupted }) {
		begin("last");
		abort("last");
		yield* Effect.promise(() => expect(pending("last").promise).rejects.toMatchObject({ name: "AbortError" }));
		yield* observe("native query work was interrupted", () => expect(interrupted()).toBe(true));
	},
);
