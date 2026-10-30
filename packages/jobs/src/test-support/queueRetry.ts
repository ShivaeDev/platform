import { Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";
import { defineQueue } from "#definition.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export function queueRetry(runtime: ReturnType<typeof pgBossRuntime>) {
	return {
		advance: (milliseconds: number) => TestClock.adjust(milliseconds),
		finish: Fiber.join,
		finished: <A, E>(fiber: Fiber.Fiber<A, E>) => fiber.pollUnsafe() !== undefined,
		start: () => runtime.boot([defineQueue({ name: "contended", schema: Schema.Struct({}) })]).pipe(Effect.forkChild),
	};
}
