import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { acquiredInScope, ci, heldBy, inheritsHolderIdOf, layerBuilt, lockStory, running } from "#test/kit.ts";

lockStory.it(
	'with CI "true", ready runs at once beside typecheck\'s lock, without a holder id',
	[heldBy("typecheck"), ci("true")],
	function* ({ holderIdGivenTo, lock, starts, stateOf }) {
		yield* starts("ready");

		yield* outcomes({
			"lock holder": [lock.holder(), "typecheck"],
			"ready": [stateOf("ready"), "running"],
			"ready's holder id": [holderIdGivenTo("ready"), "no holder id"],
		});
	},
);

lockStory.it("with CI set but empty, ready waits for typecheck's lock", [heldBy("typecheck"), ci("")], function* ({ starts, stateOf }) {
	yield* starts("ready");

	expect(yield* stateOf("ready")).toBe("waiting");
});

lockStory.it(
	"ready, inheriting build's holder id while build holds the lock, runs at once under build's hold",
	[heldBy("build"), inheritsHolderIdOf("build")],
	function* ({ holderIdGivenTo, lock, starts, stateOf }) {
		yield* starts("ready");

		yield* outcomes({
			"lock holder": [lock.holder(), "build"],
			"ready": [stateOf("ready"), "running"],
			"ready's holder id": [holderIdGivenTo("ready"), "build's holder id"],
		});
	},
);

lockStory.it(
	"when ready, running under build's inherited hold, finishes, build keeps the lock",
	[heldBy("build"), inheritsHolderIdOf("build"), running("ready")],
	function* ({ finishes, lock }) {
		expect(yield* lock.holder()).toBe("build");

		yield* finishes("ready");

		expect(yield* lock.holder()).toBe("build");
	},
);

lockStory.it(
	"ready, inheriting the holder id of build after build released the lock, takes a lock of its own",
	[inheritsHolderIdOf("build")],
	function* ({ holderIdGivenTo, lock, starts }) {
		yield* starts("ready");

		yield* outcomes({
			"lock holder": [lock.holder(), "ready"],
			"ready's holder id": [holderIdGivenTo("ready"), "ready's holder id"],
		});
	},
);

lockStory.it(
	"lint, started inside ready's hold, runs at once with ready's holder id while ready keeps the lock",
	[running("ready")],
	function* ({ holderIdGivenTo, lock, starts, stateOf }) {
		yield* starts("lint", { inside: "ready" });

		yield* outcomes({
			"lint": [stateOf("lint"), "running"],
			"lint's holder id": [holderIdGivenTo("lint"), "ready's holder id"],
			"lock holder": [lock.holder(), "ready"],
		});
	},
);

lockStory.it(
	"when lint, running inside ready's hold, finishes, ready keeps the lock",
	[running("ready"), running("lint", { inside: "ready" })],
	function* ({ finishes, lock }) {
		expect(yield* lock.holder()).toBe("ready");

		yield* finishes("lint");

		expect(yield* lock.holder()).toBe("ready");
	},
);

lockStory.it("when ready finishes, its lock is freed", [running("ready")], function* ({ finishes, lock }) {
	expect(yield* lock.holder()).toBe("ready");

	yield* finishes("ready");

	expect(yield* lock.holder()).toBe("nobody");
});

lockStory.it(
	'when ready\'s work fails with "build failed", ready ends with that failure and frees its lock',
	[running("ready")],
	function* ({ fails, lock, stateOf }) {
		expect(yield* lock.holder()).toBe("ready");

		yield* fails("ready", "build failed");

		yield* outcomes({
			"lock holder": [lock.holder(), "nobody"],
			"ready": [stateOf("ready"), 'failed with "build failed"'],
		});
	},
);

lockStory.it(
	"interrupting the running ready ends it as interrupted and frees its lock",
	[running("ready")],
	function* ({ interrupts, lock, stateOf }) {
		expect(yield* lock.holder()).toBe("ready");

		yield* interrupts("ready");

		yield* outcomes({
			"lock holder": [lock.holder(), "nobody"],
			"ready": [stateOf("ready"), "interrupted"],
		});
	},
);

lockStory.it(
	"a lock that check acquired in its scope stays held after acquisition returns, until that scope closes",
	[acquiredInScope("check")],
	function* ({ closesScope, lock }) {
		expect(yield* lock.holder()).toBe("check");

		yield* closesScope("check");

		expect(yield* lock.holder()).toBe("nobody");
	},
);

lockStory.it("the lock check's Layer took stays held until the Layer's scope closes", [layerBuilt("check")], function* ({ closesLayer, lock }) {
	expect(yield* lock.holder()).toBe("check");

	yield* closesLayer("check");

	expect(yield* lock.holder()).toBe("nobody");
});
