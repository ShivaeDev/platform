import type { ITXClientDenyList } from "@prisma/client/runtime/client";
import { type Context, Data, Effect } from "effect";
import { expectTypeOf } from "vitest";
import { makePrismaChanges } from "#changes.ts";
import type { PrismaError, TransactionExpired } from "#error.ts";
import type { ChangeMap, ModelName, ModelRow } from "#model.ts";
import { type Change, models } from "#test/changes.ts";
import type { PrismaClient } from "#test/generated/client.ts";

declare const prisma: PrismaClient;
class Rejected extends Data.TaggedError("Rejected") {}

expectTypeOf<ModelName<PrismaClient>>().toEqualTypeOf<"Order" | "Membership" | "Invoice" | "AuditNote">();
expectTypeOf<ModelRow<PrismaClient, "Order">>().toExtend<{ id: string; ownerId: string; total: number }>();
expectTypeOf<{ id: string; ownerId: string; total: number }>().toExtend<ModelRow<PrismaClient, "Order">>();

// @ts-expect-error An exhaustive map must classify every model, AuditNote included.
void ({ Invoice: models.Invoice, Membership: models.Membership, Order: models.Order } satisfies ChangeMap<PrismaClient, Change>);

void ({
	...models,
	// @ts-expect-error A mapping reads only the fields its model has.
	Order: (order) => [{ domain: "orders", subject: order.memberId }],
} satisfies ChangeMap<PrismaClient, Change>);

const changes = makePrismaChanges({ client: prisma, models, name: "Typed", publish: (_: readonly Change[]) => Effect.void });

expectTypeOf(changes.Client).toEqualTypeOf<Context.Reference<Omit<PrismaClient, ITXClientDenyList>>>();
expectTypeOf(changes.transaction(Effect.fail(new Rejected()).pipe(Effect.as("done")))).toEqualTypeOf<
	Effect.Effect<string, Rejected | TransactionExpired | PrismaError, never>
>();
expectTypeOf(changes.use((db) => db.order.count())).toEqualTypeOf<Effect.Effect<number, PrismaError, never>>();
// @ts-expect-error Inside a transaction the client cannot be extended, so `use` does not offer $extends.
changes.use((db) => db.$extends({}));
