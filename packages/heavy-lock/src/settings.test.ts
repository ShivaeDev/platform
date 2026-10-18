import { Cause, Effect, Exit, Option } from "effect";
import { assert, expect } from "vitest";
import { HeavyLockError } from "#error.ts";
import { lockStory, unreadableConfiguration } from "#test/kit.ts";

lockStory.it("missing HOME and lock path explain how to configure the lock", [], function* ({ run }) {
	const result = yield* run.readSettings();
	assert(Exit.isFailure(result));
	const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
	expect(error).toBeInstanceOf(HeavyLockError);
	expect(error.message).toBe("Set HOME or HEAVY_PROCESS_LOCK to locate the lock file.");
});

lockStory.it("an unreadable configuration preserves the error's cause", [unreadableConfiguration()], function* ({ run }) {
	const result = yield* run.readSettings();
	assert(Exit.isFailure(result));
	const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
	expect(error).toBeInstanceOf(HeavyLockError);
	expect(error.message).toBe("Could not read the heavy-lock environment.");
	expect(error.cause).toMatchObject({ _tag: "ConfigError", cause: { _tag: "SourceError", cause: { reason: { cause: { code: "ELOOP" } } } } });
	expect(String(error.cause)).toContain("CI");
});

lockStory.it("a waiter surfaces configuration failure before it can sleep", [unreadableConfiguration()], function* ({ clock }) {
	const result = yield* Effect.exit(clock.wait());
	assert(Exit.isFailure(result));
	const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
	expect(error).toBeInstanceOf(HeavyLockError);
	expect(error.message).toBe("Could not read the heavy-lock environment.");
});
