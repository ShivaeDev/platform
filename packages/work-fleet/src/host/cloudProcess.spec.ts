import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Cause, Clock, Effect, Exit } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { CONFIG_FILE } from "#host/defaults.ts";
import { hostBoard } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";

describe("Cloud host process diagnostics", () => {
	it.live("preserves interruption while closing the spawned host", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const child = yield* hostProcess("/synthetic/missing-config.json");
				const result = yield* child.until(() => Effect.interrupt).pipe(Effect.exit);
				expect(Exit.isFailure(result)).toBe(true);
				if (Exit.isFailure(result)) {
					expect(Cause.hasInterruptsOnly(result.cause)).toBe(true);
				}
			}),
		),
	);

	it.live("reports a failed startup with its exit status and stderr before the progress deadline", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const folder = yield* Effect.acquireRelease(
					Effect.sync(() => hostBoard("{")),
					(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
				);
				const started = yield* Clock.currentTimeMillis;
				const child = yield* hostProcess(join(folder, CONFIG_FILE));
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
		),
	);
});
