import { Cause, Effect, Exit } from "effect";
import { expect, it } from "vitest";
import { hooked } from "#internal/hooked.ts";

it("defers an Effect-returning hook until the story runs it", () => {
	let calls = 0;
	const effect = hooked(() => {
		calls += 1;
		return Effect.succeed(42);
	});
	expect(calls).toBe(0);
	expect(Effect.runSync(effect)).toBe(42);
	expect(calls).toBe(1);
});

it("keeps a returned Effect's typed failure in the error channel", () => {
	const error = { reason: "engine refused" };
	expect(Effect.runSyncExit(hooked(() => Effect.fail(error)))).toEqual(Exit.fail(error));
});

it("keeps a returned Effect's interruption", () => {
	const exit = Effect.runSyncExit(hooked(() => Effect.interrupt));
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
});
