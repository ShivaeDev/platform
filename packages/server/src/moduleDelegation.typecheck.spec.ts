import { Effect, type Layer, Redacted } from "effect";
import { expectTypeOf } from "vitest";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import { coachingModule, coachingWithoutRule } from "#test/subject/coaching.ts";

const served = Effect.map(appModules([coachingModule]), (modules) =>
	appHost({ postgresSettings: {}, ...modules, config: { databaseUrl: Redacted.make("postgresql://unused"), port: 0 }, policy: "loopback" }),
);
const forgotten = Effect.map(appModules([coachingWithoutRule]), (modules) =>
	appHost({ postgresSettings: {}, ...modules, config: { databaseUrl: Redacted.make("postgresql://unused"), port: 0 }, policy: "loopback" }),
);
expectTypeOf<Layer.Services<Effect.Success<typeof served>>>().toEqualTypeOf<never>();
expectTypeOf<Layer.Services<Effect.Success<typeof forgotten>>>().toEqualTypeOf<"@shivaedev/server/test/subject/CoachDelegation">();
