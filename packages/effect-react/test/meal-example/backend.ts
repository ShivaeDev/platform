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
import { Authentication, Meal, MealNotFound, Meals, Principal, SaveMeal, type SaveMealInput, StorageUnavailable, Unauthorized } from "./contract.ts";

class MealRow extends Model.Class<MealRow>("MealRow")({
	...Meal.fields,
	id: Model.Field({ select: Meal.fields.id, update: Meal.fields.id, json: Meal.fields.id }),
	ownerId: Schema.String,
}) {}
const publicMeal = (row: MealRow) => new Meal({ id: row.id, name: row.name, calories: row.calories });
const makeMealsRepository = makeRepository(MealRow, { tableName: "meals", idColumn: "id", spanPrefix: "Meals" });
class MealsRepository extends Context.Service<MealsRepository, Effect.Success<typeof makeMealsRepository>>()("meal/Repository") {}

const unavailable = () => new StorageUnavailable();
const owned = (userId: string, id: number) =>
	MealsRepository.use((repository) => repository.findById(id)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new MealNotFound())),
		Effect.filterOrFail(
			(row) => row.ownerId === userId,
			() => new MealNotFound(),
		),
	);

const MealService = defineService({
	id: "meal/Service",
	requires: [MealsRepository, SqlClient.SqlClient, Reactivity.Reactivity],
	initialize: Effect.void,
	methods: () => ({
		get: (userId: string, id: number) =>
			owned(userId, id).pipe(
				Effect.map(publicMeal),
				Effect.catchTags({ SqlError: () => Effect.fail(unavailable()), SchemaError: () => Effect.fail(unavailable()) }),
			),
		list: (userId: string) =>
			MealsRepository.use((repository) => repository.findMany({ where: { ownerId: userId }, orderBy: { field: "id", direction: "asc" } })).pipe(
				Effect.map((rows) => rows.map((row) => new Meal(row))),
				Effect.catchTags({ SqlError: () => Effect.fail(unavailable()), SchemaError: () => Effect.fail(unavailable()) }),
			),
		save: (userId: string, input: SaveMealInput) =>
			Effect.gen(function* () {
				const found = yield* owned(userId, input.id);
				const name = input.name.trim();
				if (name.length === 0) return yield* SaveMeal.reject.MealValidation({ field: "name", message: "Enter a meal name" });
				if (!Number.isInteger(input.calories) || input.calories < 0 || input.calories > 5000)
					return yield* SaveMeal.reject.MealValidation({ field: "calories", message: "Calories must be a whole number between 0 and 5000" });
				const repository = yield* MealsRepository;
				const saved = publicMeal(yield* repository.update({ ...found, name, calories: input.calories }));
				yield* invalidateOnCommit(invalidationKeys(SaveMeal.invalidates(input, saved)));
				return saved;
			}).pipe(
				Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
				transact({ onSqlError: unavailable }),
			),
	}),
});

export interface MealSession {
	readonly userId: string;
	readonly expiresAt: number;
}

export interface MealServerOptions {
	readonly sessions?: ReadonlyMap<string, MealSession>;
	readonly beforeSave?: (input: SaveMealInput) => Effect.Effect<void>;
	readonly beforeGet?: (id: number) => Effect.Effect<void>;
}

const seeded = Layer.effect(
	MealsRepository,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table meals (id integer primary key, ownerId text not null, name text not null, calories integer not null)`;
		yield* sql`insert into meals (id, ownerId, name, calories) values (1, 'alice', 'Oatmeal', 300), (2, 'bob', 'Soup', 200), (3, 'alice', 'Toast', 150)`;
		return yield* makeMealsRepository;
	}),
);

export const makeMealWebHandler = (options: MealServerOptions = {}) => {
	const sessions =
		options.sessions ??
		new Map([
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
	const service = MealService.layer.pipe(Layer.provide(seeded), Layer.provide(database));
	const handlers = Meals.toLayer(
		Effect.gen(function* () {
			const meals = yield* MealService;
			return Meals.of({
				"meals.get": ({ id }) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeGet) yield* options.beforeGet(id);
						return yield* meals.get(userId, id);
					}),
				"meals.list": () => Effect.flatMap(Principal, ({ userId }) => meals.list(userId)),
				"meals.save": (input) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeSave) yield* options.beforeSave(input);
						return yield* meals.save(userId, input);
					}),
			});
		}),
	).pipe(Layer.provide(service));
	return HttpRouter.toWebHandler(
		RpcServer.layerHttp({ group: Meals, path: "/rpc", protocol: "http" }).pipe(
			Layer.provide(handlers),
			Layer.provide(authentication),
			Layer.provide(RpcSerialization.layerJson),
		),
		{ disableLogger: true },
	);
};
