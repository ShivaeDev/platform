import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldBy, invalidHolder, lockStory } from "#test/kit.ts";

lockStory.it("typecheck takes a free lock and the lock names typecheck", [], function* ({ lock }) {
	expect(yield* lock.holder()).toBe("nobody");

	yield* lock.tries("typecheck");

	yield* outcomes({
		"lock holder": [lock.holder(), "typecheck"],
		"typecheck's answer": [lock.answerOf("typecheck"), "took the lock"],
	});
});

lockStory.it("taking a free lock leaves no draft beside it", [], function* ({ lock }) {
	yield* lock.tries("typecheck");

	expect(yield* lock.filesBesideLock()).toEqual(["heavy-process.lock"]);
});

lockStory.it("typecheck's release frees its lock", [heldBy("typecheck")], function* ({ lock }) {
	expect(yield* lock.holder()).toBe("typecheck");

	yield* lock.releases("typecheck");

	expect(yield* lock.holder()).toBe("nobody");
});

lockStory.it("a release by lint leaves typecheck holding the lock", [heldBy("typecheck")], function* ({ lock }) {
	yield* lock.releases("lint");

	expect(yield* lock.holder()).toBe("typecheck");
});

lockStory.it("test's attempt on build's live lock is blocked by build and leaves build holding it", [heldBy("build")], function* ({ lock }) {
	yield* lock.tries("test");

	yield* outcomes({
		"lock holder": [lock.holder(), "build"],
		"test's answer": [lock.answerOf("test"), "blocked by build"],
	});
});

lockStory.it("a blocked attempt leaves no draft beside the lock", [heldBy("build")], function* ({ lock }) {
	yield* lock.tries("test");

	expect(yield* lock.filesBesideLock()).toEqual(["heavy-process.lock"]);
});

for (const kind of ["exited", "reused"] as const) {
	lockStory.it(
		`test takes over crashed's lock left with ${kind === "exited" ? "a process that has exited" : "a pid that a newer process now uses"}`,
		[heldBy("crashed", kind)],
		function* ({ lock }) {
			expect(yield* lock.holder()).toBe("crashed");

			yield* lock.tries("test");

			yield* outcomes({
				"lock holder": [lock.holder(), "test"],
				"test's answer": [lock.answerOf("test"), "took the lock"],
			});
		},
	);
}

for (const kind of ["without a process start time", "that is not JSON"] as const) {
	lockStory.it(`test takes over a lock holding a holder ${kind}`, [invalidHolder(kind)], function* ({ lock }) {
		expect(yield* lock.holder()).toBe("an unreadable holder");

		yield* lock.tries("test");

		yield* outcomes({
			"lock holder": [lock.holder(), "test"],
			"test's answer": [lock.answerOf("test"), "took the lock"],
		});
	});
}

lockStory.it("taking over a dead holder's lock leaves only the lock file behind", [heldBy("crashed", "exited")], function* ({ lock }) {
	yield* lock.tries("test");

	expect(yield* lock.filesBesideLock()).toEqual(["heavy-process.lock"]);
});

lockStory.it("a waiter reclaiming crashed's lock removes it and leaves no file behind", [heldBy("crashed", "exited")], function* ({ lock }) {
	expect(yield* lock.holder()).toBe("crashed");

	yield* lock.reclaims("crashed");

	yield* outcomes({
		"files beside the lock": [lock.filesBesideLock(), []],
		"lock holder": [lock.holder(), "nobody"],
	});
});

lockStory.it(
	"a waiter reclaiming crashed's lock after raced took it over puts raced's lock back",
	[heldBy("crashed", "exited")],
	function* ({ lock }) {
		yield* lock.tries("raced");
		expect(yield* lock.holder()).toBe("raced");

		yield* lock.reclaims("crashed");

		yield* outcomes({
			"files beside the lock": [lock.filesBesideLock(), ["heavy-process.lock"]],
			"lock holder": [lock.holder(), "raced"],
		});
	},
);

lockStory.it("reclaiming crashed's lock again after it is gone leaves no file behind", [heldBy("crashed", "exited")], function* ({ lock }) {
	yield* lock.reclaims("crashed");

	yield* lock.reclaims("crashed");

	expect(yield* lock.filesBesideLock()).toEqual([]);
});
