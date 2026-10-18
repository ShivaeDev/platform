import { Option } from "effect";
import { expect } from "vitest";
import { heldBy, invalidHolder, lockStory } from "#test/kit.ts";

lockStory.it("a free lock names its holder and only that holder releases it", [], function* ({ lock }) {
	expect(yield* lock.acquire("typecheck")).toEqual(Option.none());
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("typecheck")));
	expect(lock.files()).toEqual(["heavy-process.lock"]);
	yield* lock.release("someone-else");
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("typecheck")));
	yield* lock.release("typecheck");
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a live process with a matching start time cannot be preempted", [heldBy("build")], function* ({ lock }) {
	expect(yield* lock.acquire("test")).toEqual(Option.some(lock.holder("build")));
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("build")));
	expect(lock.files()).toEqual(["heavy-process.lock"]);
});

for (const kind of ["stale", "reused"] as const) {
	lockStory.it(`a ${kind} process's lock is reclaimed`, [heldBy("crashed", kind)], function* ({ lock }) {
		expect(yield* lock.acquire("test")).toEqual(Option.none());
		expect(yield* lock.read()).toEqual(Option.some(lock.holder("test")));
		expect(lock.files()).toEqual(["heavy-process.lock"]);
	});
}

for (const kind of ["unversioned", "malformed"] as const) {
	lockStory.it(`a ${kind} holder is reclaimed`, [invalidHolder(kind)], function* ({ lock }) {
		expect(yield* lock.acquire("test")).toEqual(Option.none());
		expect(yield* lock.read()).toEqual(Option.some(lock.holder("test")));
		expect(lock.files()).toEqual(["heavy-process.lock"]);
	});
}

lockStory.it("reclamation restores a live holder that raced in first and drops the dead one", [heldBy("crashed", "stale")], function* ({ lock }) {
	expect(yield* lock.acquire("raced")).toEqual(Option.none());
	yield* lock.reclaim("crashed");
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("raced")));
	expect(lock.files()).toEqual(["heavy-process.lock"]);
	yield* lock.reclaim("raced");
	expect(lock.contents()).toBeUndefined();
	expect(lock.files()).toEqual([]);
});

lockStory.it("reclaiming an already removed lock leaves no stale file", [heldBy("crashed", "stale")], function* ({ lock }) {
	yield* lock.reclaim("crashed");
	yield* lock.reclaim("crashed");
	expect(lock.contents()).toBeUndefined();
	expect(lock.files()).toEqual([]);
});
