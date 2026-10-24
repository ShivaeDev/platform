import { describe, expect } from "@effect/vitest";
import { Cause, Clock, Effect, Exit } from "effect";
import { host } from "#test/hostStory.ts";

describe("Cloud host process diagnostics", () => {
	host.it("preserves interruption while closing the spawned host", [], function* (daemon) {
		return yield* Effect.scoped(
			Effect.gen(function* () {
				const child = yield* daemon.spawnMissingHost();
				const result = yield* child.until(() => Effect.interrupt).pipe(Effect.exit);
				expect(Exit.isFailure(result)).toBe(true);
				if (Exit.isFailure(result)) {
					expect(Cause.hasInterruptsOnly(result.cause)).toBe(true);
				}
			}),
		);
	});

	host.it("reports a failed startup with its exit status and stderr before the progress deadline", [], function* (daemon) {
		return yield* Effect.scoped(
			Effect.gen(function* () {
				const started = yield* Clock.currentTimeMillis;
				const child = yield* daemon.spawnInvalidHost();
				const result = yield* child.until(() => Effect.succeed(false)).pipe(Effect.exit);
				expect(Exit.isFailure(result)).toBe(true);
				if (Exit.isFailure(result)) {
					const message = Cause.pretty(result.cause);
					expect(message).toContain("exited (code 1, signal null)");
					expect(message).toContain("Host stderr:");
					expect(message).toContain("Fleet host configuration");
					expect(message).toContain("is invalid");
					expect(message).not.toContain("Restart progress stalled");
				}
				const killed = yield* child.kill.pipe(Effect.exit);
				expect(Exit.isFailure(killed)).toBe(true);
				if (Exit.isFailure(killed)) {
					expect(Cause.pretty(killed.cause)).toContain("Host did not exit from SIGKILL");
					expect(Cause.pretty(killed.cause)).toContain("Host stderr:");
				}
				expect((yield* Clock.currentTimeMillis) - started).toBeLessThan(20_000);
			}),
		);
	});
});
