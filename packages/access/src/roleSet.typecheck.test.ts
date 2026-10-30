import type { Effect, Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { requirePermission } from "#requirePermission.ts";
import { role } from "#role.ts";
import type { User } from "#roleSet.ts";
import { roleSet } from "#roleSet.ts";
import { Access, Guest, Manager, Reader, ReadUsers } from "#test/policy.ts";

expectTypeOf<typeof Access.Role.Type>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<typeof Access.Role.Encoded>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<User<typeof Access.Role.Type>["role"]>().toEqualTypeOf<"reader" | "manager" | "guest">();
expectTypeOf<Effect.Error<ReturnType<typeof requirePermission>>>().toEqualTypeOf<Forbidden>();
expectTypeOf<Effect.Error<ReturnType<typeof Access.requireAccess>>>().toEqualTypeOf<Forbidden | Unauthorized>();
expectTypeOf<typeof Access.Role>().toExtend<Schema.Schema<"reader" | "manager" | "guest">>();

// @ts-expect-error Callers must decode untrusted role strings before using them.
Access.hasPermission("unknown", ReadUsers);

// @ts-expect-error Role sets refuse a role name declared twice.
roleSet(Reader, Manager, role("reader", []));

// @ts-expect-error A repeated name is refused wherever it appears in the list.
roleSet(Reader, Manager, Guest, role("manager", [ReadUsers]));
