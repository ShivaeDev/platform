import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { invalidationKeys } from "@shivaedev/effect-contract";
import { defineService } from "@shivaedev/effect-service";
import { invalidateOnCommit, makeRepository, transact } from "@shivaedev/effect-sql";
import { Clock, Context, Effect, Layer, Schema } from "effect";
import { HttpRouter } from "effect/unstable/http";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import {
	Authentication,
	Order,
	OrderNotFound,
	Orders,
	Principal,
	SaveOrder,
	type SaveOrderInput,
	StorageUnavailable,
	Unauthorized,
} from "./contract.ts";

class OrderRow extends Model.Class<OrderRow>("OrderRow")({
	...Order.fields,
	id: Model.Field({ select: Order.fields.id, update: Order.fields.id, json: Order.fields.id }),
	ownerId: Schema.String,
}) {}
const publicOrder = (row: OrderRow) => new Order({ id: row.id, name: row.name, quantity: row.quantity });
const makeOrdersRepository = makeRepository(OrderRow, { tableName: "orders", idColumn: "id", spanPrefix: "Orders" });
class OrdersRepository extends Context.Service<OrdersRepository, Effect.Success<typeof makeOrdersRepository>>()("order/Repository") {}

const unavailable = () => new StorageUnavailable();
const owned = (userId: string, id: number) =>
	OrdersRepository.use((repository) => repository.findById(id)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new OrderNotFound())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new OrderNotFound(),
		),
	);

const OrderService = defineService({
	id: "order/Service",
	requires: [OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
	initialize: Effect.void,
	methods: () => ({
		get: (userId: string, id: number) =>
			owned(userId, id).pipe(
				Effect.map(publicOrder),
				Effect.catchTags({ SqlError: () => Effect.fail(unavailable()), SchemaError: () => Effect.fail(unavailable()) }),
			),
		list: (userId: string) =>
			OrdersRepository.use((repository) => repository.findMany({ where: { ownerId: userId }, orderBy: { field: "id", direction: "asc" } })).pipe(
				Effect.map((rows) => rows.map((row) => new Order(row))),
				Effect.catchTags({ SqlError: () => Effect.fail(unavailable()), SchemaError: () => Effect.fail(unavailable()) }),
			),
		save: (userId: string, input: SaveOrderInput) =>
			Effect.gen(function* () {
				const found = yield* owned(userId, input.id);
				const name = input.name.trim();
				if (name.length === 0) return yield* SaveOrder.reject.OrderValidation({ field: "name", message: "Enter an order name" });
				if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 5000)
					return yield* SaveOrder.reject.OrderValidation({ field: "quantity", message: "Quantity must be a whole number between 0 and 5000" });
				const repository = yield* OrdersRepository;
				const saved = publicOrder(yield* repository.update({ ...found, name, quantity: input.quantity }));
				yield* invalidateOnCommit(invalidationKeys(SaveOrder.invalidates(input, saved)));
				return saved;
			}).pipe(
				Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
				transact({ onSqlError: unavailable }),
			),
	}),
});

export interface OrderSession {
	readonly userId: string;
	readonly expiresAt: number;
}

export interface OrderServerOptions {
	readonly sessions?: ReadonlyMap<string, OrderSession>;
	readonly beforeSave?: (input: SaveOrderInput) => Effect.Effect<void>;
	readonly beforeGet?: (id: number) => Effect.Effect<void>;
}

const seeded = Layer.effect(
	OrdersRepository,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table orders (id integer primary key, ownerId text not null, name text not null, quantity integer not null)`;
		yield* sql`insert into orders (id, ownerId, name, quantity) values (1, 'alice', 'Printer paper', 300), (2, 'bob', 'Desk lamps', 200), (3, 'alice', 'Toner', 150)`;
		return yield* makeOrdersRepository;
	}),
);

export const makeOrderWebHandler = (options: OrderServerOptions = {}) => {
	const sessions =
		options.sessions
		?? new Map([
			["alice-session", { userId: "alice", expiresAt: Number.POSITIVE_INFINITY }],
			["bob-session", { userId: "bob", expiresAt: Number.POSITIVE_INFINITY }],
		]);
	const authentication = Layer.succeed(Authentication, (effect, { headers }) =>
		Effect.gen(function* () {
			const authorization = headers.authorization;
			const session = authorization?.startsWith("Bearer ") ? sessions.get(authorization.slice(7)) : undefined;
			const now = yield* Clock.currentTimeMillis;
			if (session === undefined || session.expiresAt <= now) return yield* new Unauthorized();
			return yield* Effect.provideService(effect, Principal, { userId: session.userId });
		}),
	);
	const database = Layer.merge(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer);
	const service = OrderService.layer.pipe(Layer.provide(seeded), Layer.provide(database));
	const handlers = Orders.toLayer(
		Effect.gen(function* () {
			const orders = yield* OrderService;
			return Orders.of({
				"orders.get": ({ id }) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeGet) yield* options.beforeGet(id);
						return yield* orders.get(userId, id);
					}),
				"orders.list": () => Effect.flatMap(Principal, ({ userId }) => orders.list(userId)),
				"orders.save": (input) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeSave) yield* options.beforeSave(input);
						return yield* orders.save(userId, input);
					}),
			});
		}),
	).pipe(Layer.provide(service));
	return HttpRouter.toWebHandler(
		RpcServer.layerHttp({ group: Orders, path: "/rpc", protocol: "http" }).pipe(
			Layer.provide(handlers),
			Layer.provide(authentication),
			Layer.provide(RpcSerialization.layerJson),
		),
		{ disableLogger: true },
	);
};
