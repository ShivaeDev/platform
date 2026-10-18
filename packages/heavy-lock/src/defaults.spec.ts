import { Option } from "effect";
import { expect } from "vitest";
import { HOLDER_ID_ENV } from "#holder.ts";
import { argumentsAfterExecutable, heldBy, lockStory, pathEnvironment, withoutOption } from "#test/kit.ts";

lockStory.it("an explicit lock path wins over both environment paths", [pathEnvironment()], function* ({ run, lock }) {
	const command = yield* run.start();
	const env = yield* run.environment(command);
	expect(env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(yield* lock.read(lock.paths.explicit)).id });
	expect(lock.contents(lock.paths.environment)).toBeUndefined();
	expect(lock.contents(lock.paths.home)).toBeUndefined();
	yield* run.complete(command);
	yield* run.join(command);
	expect(lock.contents(lock.paths.explicit)).toBeUndefined();
});

lockStory.it(
	"HEAVY_PROCESS_LOCK wins over HOME when the path option is omitted",
	[pathEnvironment(), withoutOption("lockPath")],
	function* ({ run, lock }) {
		const command = yield* run.start();
		const env = yield* run.environment(command);
		expect(env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(yield* lock.read(lock.paths.environment)).id });
		expect(lock.contents(lock.paths.explicit)).toBeUndefined();
		expect(lock.contents(lock.paths.home)).toBeUndefined();
		yield* run.complete(command);
		yield* run.join(command);
		expect(lock.contents(lock.paths.environment)).toBeUndefined();
	},
);

lockStory.it(
	"HOME supplies the shared cache lock when neither path override is set",
	[pathEnvironment("home"), withoutOption("lockPath")],
	function* ({ run, lock }) {
		const command = yield* run.start();
		const env = yield* run.environment(command);
		expect(env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(yield* lock.read(lock.paths.home)).id });
		expect(lock.contents(lock.paths.explicit)).toBeUndefined();
		expect(lock.contents(lock.paths.environment)).toBeUndefined();
		yield* run.complete(command);
		yield* run.join(command);
		expect(lock.contents(lock.paths.home)).toBeUndefined();
	},
);

lockStory.it(
	"an omitted command records this process's arguments after the executable",
	[withoutOption("command"), argumentsAfterExecutable("scripts/build.ts", "--target", "heavy build")],
	function* ({ run, lock }) {
		const command = yield* run.start();
		yield* run.environment(command);
		expect(Option.getOrThrow(yield* lock.read()).command).toBe("scripts/build.ts --target heavy build");
		yield* run.complete(command);
		yield* run.join(command);
		expect(lock.contents()).toBeUndefined();
	},
);

lockStory.it("an omitted polling interval retries at one second", [withoutOption("pollInterval"), heldBy("build")], function* ({ clock, lock }) {
	const waiter = yield* clock.wait();
	yield* lock.release("build");
	yield* waiter.advance(999);
	expect(lock.contents()).toBeUndefined();
	yield* waiter.advance(1);
	expect(Option.map(yield* lock.read(), ({ startedAtMs }) => startedAtMs)).toEqual(Option.some(1000));
	yield* waiter.finish();
	expect(lock.contents()).toBeUndefined();
});

lockStory.it("direct acquisition holds until its surrounding Scope closes", [], function* ({ run, clock, lock }) {
	const scope = yield* run.openScope();
	const held = yield* run.acquire(scope);
	const holder = Option.getOrThrow(yield* lock.read());
	expect(held.env).toEqual({ [HOLDER_ID_ENV]: holder.id });
	const waiter = yield* clock.wait();
	yield* waiter.advance(10_000);
	expect(yield* lock.read()).toEqual(Option.some(holder));
	expect(waiter.lines()[0]).toContain("running `pnpm ready`");
	yield* run.closeScope(scope);
	expect(lock.contents()).toBeUndefined();
	yield* waiter.advance(10_000);
	expect(Option.getOrThrow(yield* lock.read()).id).not.toBe(holder.id);
	yield* waiter.finish();
	expect(lock.contents()).toBeUndefined();
});
