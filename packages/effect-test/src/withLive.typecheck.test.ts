import { Context, Effect } from "effect";
import { expectTypeOf } from "vitest";
import { withLive } from "#withLive.ts";

class Queue extends Context.Service<Queue, string>()("@types/Queue") {}

const poll = Effect.gen(function* () {
	const value = yield* Queue;
	return value === "empty" ? 1 : yield* Effect.fail("pending" as const);
});

expectTypeOf(withLive(poll)).toEqualTypeOf<Effect.Effect<number, "pending", Queue>>();
