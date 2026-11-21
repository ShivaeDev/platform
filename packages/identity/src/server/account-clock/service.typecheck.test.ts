import { Effect, type Layer, type Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AccountClock } from "#server/account-clock/service.ts";
import type { AccountPreferencesStore } from "#server/account-preferences/service.ts";

expectTypeOf<Layer.Services<typeof AccountClock.layer>>().toEqualTypeOf<typeof AccountPreferencesStore.Identifier>();

const reads = Effect.gen(function* () {
	const clock = yield* AccountClock;
	const day = yield* clock.logicalDay("account");
	return yield* clock.dayRange("account", day);
});
expectTypeOf<Effect.Error<typeof reads>>().toEqualTypeOf<AuthUnavailable | Schema.SchemaError>();
expectTypeOf<Effect.Services<typeof reads>>().toEqualTypeOf<typeof AccountClock.Identifier>();
