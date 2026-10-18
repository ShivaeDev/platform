import { Cause, Effect, Exit, Option } from "effect";
import { assert, expect } from "vitest";
import { HOLDER_ID_ENV } from "#holder.ts";
import { environment, heldBy, lockStory, pollingEvery } from "#test/kit.ts";

lockStory.it("a waiter names its holder, reminds every minute, then acquires and releases", [heldBy("e2e")], function* ({ clock, lock }) {
	const waiter = yield* clock.wait(30_000);
	expect(waiter.lines()).toHaveLength(1);
	expect(waiter.lines()[0]).toMatch(/^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(30s\)$/u);
	yield* waiter.advance(55_000);
	expect(waiter.lines()).toHaveLength(1);
	yield* waiter.advance(5000);
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

lockStory.it("a waiter polls at its configured interval across partial advances", [heldBy("build"), pollingEvery(7000)], function* ({ clock, lock }) {
	const waiter = yield* clock.wait();
	yield* lock.release("build");
	yield* waiter.advance(6000);
	expect(lock.contents()).toBeUndefined();
	expect(waiter.lines()).toHaveLength(1);
	yield* waiter.advance(1000);
	const held = yield* waiter.finish();
	expect(Option.map(held.holder, ({ startedAtMs }) => startedAtMs)).toEqual(Option.some(7000));
	expect(waiter.lines()[1]).toBe("heavy-process lock: acquired after 7s");
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("CI skips a lock held by another run", [heldBy("typecheck"), environment({ "CI": "true" })], function* ({ run, lock }) {
	const command = yield* run.start();
	expect(yield* run.environment(command)).toEqual({});
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("typecheck")));
	yield* run.complete(command);
	yield* run.join(command);
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("typecheck")));
});

lockStory.it("an empty CI still acquires the lock", [environment({ "CI": "" })], function* ({ run, lock }) {
	const command = yield* run.start();
	const env = yield* run.environment(command);
	expect(env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(yield* lock.read()).id });
	yield* run.complete(command);
	yield* run.join(command);
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
		const descendant = yield* run.start();
		expect(yield* run.environment(descendant)).toEqual({ [HOLDER_ID_ENV]: "ready" });
		expect(yield* lock.read()).toEqual(Option.some(lock.holder("ready")));
		yield* run.complete(descendant);
		yield* run.join(descendant);
		expect(yield* lock.read()).toEqual(Option.some(lock.holder("ready")));
		yield* lock.release("ready");
		const fresh = yield* run.start();
		const env = yield* run.environment(fresh);
		const holder = Option.getOrThrow(yield* lock.read());
		expect(holder.id).not.toBe("ready");
		expect(env).toEqual({ [HOLDER_ID_ENV]: holder.id });
		yield* run.complete(fresh);
		yield* run.join(fresh);
		expect(lock.contents()).toBeUndefined();
	},
);

lockStory.it("acquisition inside a held lock joins the hold", [], function* ({ run, lock }) {
	const outer = yield* run.start();
	const env = yield* run.environment(outer);
	const before = lock.contents();
	const inner = yield* run.startNested(outer);
	expect(yield* run.environment(inner)).toEqual(env);
	expect(lock.contents()).toBe(before);
	yield* run.complete(inner);
	yield* run.join(inner);
	expect(lock.contents()).toBe(before);
	yield* run.complete(outer);
	yield* run.join(outer);
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a failing command releases the lock and keeps its error", [], function* ({ run, lock }) {
	const command = yield* run.start();
	yield* run.environment(command);
	expect(lock.contents()).toBeDefined();
	yield* run.fail(command, "build failed");
	const result = yield* run.exit(command);
	assert(Exit.isFailure(result));
	expect(Cause.findErrorOption(result.cause)).toEqual(Option.some("build failed"));
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("a layer holds the lock for its scope", [], function* ({ run, lock }) {
	const layer = yield* run.buildLayer();
	expect(lock.contents()).toMatch(/"command":"/u);
	yield* run.closeLayer(layer);
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("an interrupted waiter leaves its holder's lock alone and no temporary files", [heldBy("build")], function* ({ clock, lock }) {
	const before = lock.contents();
	const waiter = yield* clock.wait();
	expect(waiter.lines()[0]).toContain("running `pnpm build`");
	yield* waiter.interrupt();
	expect(Exit.hasInterrupts(yield* Effect.exit(waiter.advance(10_000)))).toBe(true);
	expect(yield* lock.read()).toEqual(Option.some(lock.holder("build")));
	expect(lock.contents()).toBe(before);
	expect(lock.files()).toEqual(["heavy-process.lock"]);
});

lockStory.it("interrupting the running command releases its lock", [], function* ({ run, lock }) {
	const command = yield* run.start();
	yield* run.environment(command);
	expect(lock.contents()).toBeDefined();
	yield* run.interrupt(command);
	expect(lock.contents()).toBeUndefined();
});
