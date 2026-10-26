import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Order } from "./contract.ts";

const Seed = Schema.Struct({
	name: Order.fields.name.check(Schema.isNonEmpty()),
	ownerId: Schema.String,
	quantity: Order.fields.quantity.check(Schema.isInt(), Schema.isBetween({ maximum: 5000, minimum: 0 })),
});

export const seedOrder = Effect.fn("OrderSeed.seedOrder")(function* (overrides: Partial<typeof Seed.Type> = {}) {
	const values = yield* Schema.decodeUnknownEffect(Seed)({ name: "Printer paper", ownerId: "alice", quantity: 3, ...overrides });
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ readonly id: number }>`insert into orders ${sql.insert(values)} returning id`;
	const id = rows[0]?.id;
	if (id === undefined) {
		return yield* Effect.die(new Error("Order seed returned no generated id"));
	}
	return new Order({ id, name: values.name, quantity: values.quantity });
});
