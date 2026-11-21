import { Effect, type Layer, type Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AccountClock } from "#server/account-clock/service.ts";
import type { AccountPreferencesStore } from "#server/account-preferences/service.ts";

expectTypeOf<Layer.Services<typeof AccountClock.layer>>().toEqualTypeOf<typeof AccountPreferencesStore.Identifier>();

const day = Effect.flatMap(AccountClock, (clock) => clock.logicalDay("account"));
const range = Effect.flatMap(AccountClock, (clock) => clock.dayRange("account", "2026-03-08"));
expectTypeOf<Effect.Error<typeof day>>().toEqualTypeOf<AuthUnavailable>();
expectTypeOf<Effect.Error<typeof range>>().toEqualTypeOf<AuthUnavailable | Schema.SchemaError>();
expectTypeOf<Effect.Services<typeof day | typeof range>>().toEqualTypeOf<typeof AccountClock.Identifier>();
