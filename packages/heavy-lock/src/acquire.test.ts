import { Option } from "effect";
import { expect } from "vitest";
import { HOLDER_ID_ENV } from "#holder.ts";
import { environment, heldBy, lockStory } from "#test/kit.ts";

lockStory.it("a waiter names its holder, reminds every minute, then acquires and releases", [heldBy("e2e")], function* ({ clock, lock }) {
	const waiter = yield* clock.wait(30_000);
	expect(waiter.lines()).toHaveLength(1);
	expect(waiter.lines()[0]).toMatch(/^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(30s\)$/u);
	yield* waiter.advance(50_000);
	expect(waiter.lines()).toHaveLength(1);
	yield* waiter.advance(10_000);
	expect(waiter.lines()).toHaveLength(2);
	expect(waiter.lines()[1]).toMatch(/^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(1m 30s\)$/u);
	yield* lock.release("e2e");
	yield* waiter.advance(10_000);
	const held = yield* waiter.finish();
	expect(Option.map(held.holder, ({ command, startedAtMs }) => ({ command, startedAtMs }))).toEqual(
		Option.some({ command: "pnpm ready", startedAtMs: 100_000 }),
	);
	expect(held.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(held.holder).id });
	expect(waiter.lines()).toHaveLength(3);
	expect(waiter.lines()[2]).toBe("heavy-process lock: acquired after 1m 10s");
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("CI skips a lock held by another run", [heldBy("typecheck"), environment({ "CI": "true" })], function* ({ run, lock }) {
	const skipped = yield* run.hold();
	expect(skipped.env).toEqual({});
	expect(skipped.holder).toEqual(Option.some(lock.holder("typecheck")));
});

lockStory.it("an empty CI still acquires the lock", [environment({ "CI": "" })], function* ({ run, lock }) {
	const taken = yield* run.hold();
	expect(taken.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(taken.holder).id });
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a waiter stays quiet between reminders and immediately names a replacement", [heldBy("build")], function* ({ clock, lock }) {
	const waiter = yield* clock.wait();
	yield* waiter.advance(10_000);
	expect(waiter.lines()).toHaveLength(1);
	yield* lock.replace("typecheck", 20_000);
	yield* waiter.advance(10_000);
	expect(waiter.lines()).toHaveLength(2);
	expect(waiter.lines()[0]).toContain("running `pnpm build`");
	expect(waiter.lines()[1]).toContain("running `pnpm typecheck`");
	yield* lock.release("typecheck");
	yield* waiter.advance(10_000);
	yield* waiter.finish();
	expect(waiter.lines()).toHaveLength(3);
	expect(waiter.lines()[2]).toBe("heavy-process lock: acquired after 30s");
	expect(lock.contents()).toBeUndefined();
});

lockStory.it(
	"descendants join a holder's lock and a finished holder's id acquires a fresh one",
	[heldBy("ready"), environment({ [HOLDER_ID_ENV]: "ready" })],
	function* ({ run, lock }) {
		const nested = yield* run.hold();
		expect(nested.env).toEqual({ [HOLDER_ID_ENV]: "ready" });
		expect(nested.holder).toEqual(Option.some(lock.holder("ready")));
		yield* lock.release("ready");
		const fresh = yield* run.hold();
		expect(Option.map(fresh.holder, ({ id }) => id)).not.toEqual(Option.some("ready"));
		expect(fresh.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(fresh.holder).id });
	},
);

lockStory.it("acquisition inside a held lock joins the hold", [], function* ({ run, lock }) {
	const [outer, inner] = yield* run.nested();
	expect(inner).toEqual(outer);
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a failing command releases the lock and keeps its error", [], function* ({ run, lock }) {
	expect(yield* run.fail()).toBe("build failed");
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a layer holds the lock for its scope", [], function* ({ run, lock }) {
	expect(yield* run.layer()).toMatch(/"command":"/u);
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("an interrupted waiter leaves its holder's lock alone and no temporary files", [heldBy("build")], function* ({ run, lock }) {
	const before = lock.contents();
	yield* run.interruptWaiter();
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("build")));
	expect(lock.contents()).toBe(before);
	expect(lock.files()).toEqual(["heavy-process.lock"]);
});

lockStory.it("interrupting the running command releases its lock", [], function* ({ run, lock }) {
	yield* run.interruptHolder();
	expect(lock.contents()).toBeUndefined();
});
