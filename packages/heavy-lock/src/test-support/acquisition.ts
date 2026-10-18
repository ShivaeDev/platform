import { Effect, Fiber, Layer } from "effect";
import { TestConsole } from "effect/testing";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { withLive } from "@shivaedev/effect-test/withLive.ts";
import { HeldLock } from "#held-lock.ts";
import { readHolder } from "#lock-file.ts";
import { readSettings } from "#settings.ts";
import { heavyLockLayer, withHeavyLock } from "#with-heavy-lock.ts";
import { waitFor } from "./cliProcess.ts";
import { configured, type Lock, readLock } from "./lock.ts";

export function acquisition(engine: Lock, tell: (line: string) => void) {
	const observe = Effect.gen(function* () {
		const held = yield* HeldLock;
		return { env: held.env, holder: yield* readHolder(engine.lock), recorded: readLock(engine.lock) };
	});
	function hold<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return configured(engine, withHeavyLock(effect, engine.options));
	}
	return {
		fail: () => {
			tell("the command fails");
			return hold(Effect.fail("build failed")).pipe(Effect.flip);
		},
		hold: () => {
			tell("a command runs under the lock");
			return hold(observe);
		},
		interruptHolder: () =>
			Effect.gen(function* () {
				tell("a running command is interrupted");
				const running = yield* Effect.forkChild(hold(Effect.never));
				yield* Effect.promise(() => waitFor(() => readLock(engine.lock) !== undefined));
				yield* Fiber.interrupt(running);
			}),
		interruptWaiter: () =>
			Effect.gen(function* () {
				tell("a waiter is interrupted after announcing the holder");
				const waiter = yield* Effect.forkChild(hold(Effect.void));
				yield* withLive(
					eventually(
						TestConsole.errorLines.pipe(
							Effect.flatMap((lines) => (lines.length > 0 ? Effect.void : Effect.fail("The waiter has not announced its holder."))),
						),
						{ times: 1000 },
					),
				);
				yield* Fiber.interrupt(waiter);
			}),
		layer: () => {
			tell("a layer holds the lock until its scope closes");
			return configured(
				engine,
				Effect.scoped(Effect.flatMap(Layer.build(heavyLockLayer(engine.options)), () => Effect.sync(() => readLock(engine.lock)))),
			);
		},
		nested: () => {
			tell("a command acquires the lock inside its own hold");
			return hold(Effect.zip(observe, withHeavyLock(observe, engine.options)));
		},
		settingsError: () => configured(engine, readSettings(undefined)).pipe(Effect.flip),
	};
}
