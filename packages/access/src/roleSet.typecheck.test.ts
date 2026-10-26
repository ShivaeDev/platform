import type { Effect, Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { Forbidden, Unauthorized } from "@shivaedev/contract/errors/taxonomy.ts";
import type { User } from "#roleSet.ts";
import { Access, ReadUsers } from "#test/policy.ts";

expectTypeOf<typeof Access.Role.Type>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<typeof Access.Role.Encoded>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<User<typeof Access.Role.Type>["role"]>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<Effect.Error<ReturnType<typeof Access.requirePermission>>>().toEqualTypeOf<Forbidden | Unauthorized>();
expectTypeOf<Effect.Error<ReturnType<typeof Access.requireAccess>>>().toEqualTypeOf<Forbidden | Unauthorized>();
expectTypeOf<typeof Access.Role>().toExtend<Schema.Schema<"reader" | "manager" | "guest">>();

// @ts-expect-error Callers must decode untrusted role strings before using them.
Access.hasPermission("unknown", ReadUsers);
