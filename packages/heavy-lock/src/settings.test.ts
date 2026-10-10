import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { afterEach } from "vitest";
import { HeavyLockError } from "#error.ts";
import { readSettings } from "#settings.ts";
import { removeTemporaryDirectories, services, unreadableConfigDirectory } from "#test/lock.ts";

afterEach(removeTemporaryDirectories);

it.effect("an environment without HOME or a lock path explains how to configure the lock", () =>
	Effect.gen(function* () {
		const error = yield* readSettings(undefined).pipe(Effect.flip);

		expect(error).toBeInstanceOf(HeavyLockError);
		expect(error.message).toBe("Set HOME or HEAVY_PROCESS_LOCK to locate the lock file.");
	}).pipe(Effect.provide(services())),
);

it.effect("an unreadable config directory reports the configuration error and preserves its cause", () =>
	Effect.gen(function* () {
		const provider = yield* ConfigProvider.fromDir({ rootPath: unreadableConfigDirectory() });
		const error = yield* readSettings(undefined).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider), Effect.flip);

		expect(error).toBeInstanceOf(HeavyLockError);
		expect(error.message).toBe("Could not read the heavy-lock environment.");
		expect(error.cause).toMatchObject({ _tag: "ConfigError", cause: { _tag: "SourceError", cause: { reason: { cause: { code: "ELOOP" } } } } });
		expect(String(error.cause)).toContain("CI");
	}).pipe(Effect.provide(services())),
);
