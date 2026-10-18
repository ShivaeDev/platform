import { expect } from "vitest";
import { HeavyLockError } from "#error.ts";
import { lockStory, unreadableConfiguration } from "#test/kit.ts";

lockStory.it("missing HOME and lock path explain how to configure the lock", [], function* ({ run }) {
	const error = yield* run.settingsError();
	expect(error).toBeInstanceOf(HeavyLockError);
	expect(error.message).toBe("Set HOME or HEAVY_PROCESS_LOCK to locate the lock file.");
});

lockStory.it("an unreadable configuration preserves the error's cause", [unreadableConfiguration()], function* ({ run }) {
	const error = yield* run.settingsError();
	expect(error).toBeInstanceOf(HeavyLockError);
	expect(error.message).toBe("Could not read the heavy-lock environment.");
	expect(error.cause).toMatchObject({ _tag: "ConfigError", cause: { _tag: "SourceError", cause: { reason: { cause: { code: "ELOOP" } } } } });
	expect(String(error.cause)).toContain("CI");
});
