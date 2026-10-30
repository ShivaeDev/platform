import { type Cause, Effect, type Result, Scope } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { defineService } from "@shivaedev/service/defineService.ts";
import { raceWithLock } from "#raceWithLock.ts";

const Dependency = defineService({
	id: "RaceDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
type Dependency = typeof Dependency.Identifier;

const race = raceWithLock({
	effects: [
		Effect.gen(function* () {
			yield* Dependency;
			yield* Scope.Scope;
			return yield* Effect.fail("full" as const);
		}),
	],
	lock: Effect.fail("lock failed" as const),
});

expectTypeOf<Effect.Success<typeof race>>().toEqualTypeOf<Result.Result<never, "full">[]>();
expectTypeOf<Effect.Error<typeof race>>().toEqualTypeOf<"lock failed" | SqlError | Cause.TimeoutError>();
expectTypeOf<Effect.Services<typeof race>>().toEqualTypeOf<Dependency | SqlClient.SqlClient | Reactivity.Reactivity>();
