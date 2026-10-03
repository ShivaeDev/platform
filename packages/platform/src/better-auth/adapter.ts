import type { AnyDatabase } from "@shivaedev/effect-prisma";
import type { BetterAuthOptions, DBAdapterInstance } from "better-auth";
import { createAdapterFactory } from "better-auth/adapters";
import { Effect } from "effect";
import type { PlatformRuntime } from "../runtime/types.ts";
import { type DynamicRelation, refineRelation } from "./relation.ts";
import { makeRowAdapter, type RelationQuery } from "./row-adapter.ts";

export interface EffectPrismaAdapterOptions {
	readonly debugLogs?: boolean;
	readonly modelName?: (model: string) => string;
	readonly usePlural?: boolean;
}

interface DynamicDatabase {
	readonly transaction: <A, E, R>(program: Effect.Effect<A, E, R>) => Effect.Effect<A, unknown, unknown>;
}

const isFunction = (value: unknown, key: string): boolean =>
	((typeof value === "object" && value !== null) || typeof value === "function") && typeof Reflect.get(value, key) === "function";

const isDynamicDatabase = (value: unknown): value is DynamicDatabase => isFunction(value, "transaction");

const isDynamicRelation = (value: unknown): value is DynamicRelation<unknown> => isFunction(value, "where") && isFunction(value, "select");

const modelRelation = (database: DynamicDatabase, model: string): DynamicRelation<unknown> => {
	const relation: unknown = Reflect.get(database, model);
	if (!isDynamicRelation(relation)) {
		throw new TypeError(`Unknown database model: ${model}`);
	}
	return relation;
};

const defaultModelName = (model: string): string => (model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`);

export function effectPrismaAdapter<Database extends AnyDatabase, Services, BuildError>(
	databaseTag: Database,
	runtime: PlatformRuntime<Services, BuildError>,
	adapterOptions?: EffectPrismaAdapterOptions,
): DBAdapterInstance;
export function effectPrismaAdapter(
	databaseTag: AnyDatabase,
	runtime: PlatformRuntime<unknown, unknown>,
	adapterOptions: EffectPrismaAdapterOptions = {},
): DBAdapterInstance {
	return (authOptions: BetterAuthOptions) => {
		const mapModelName = adapterOptions.modelName ?? defaultModelName;
		const databaseEffect = Effect.flatMap(databaseTag, (database) =>
			isDynamicDatabase(database) ? Effect.succeed(database) : Effect.die(new TypeError("The database service has no transaction")),
		);

		const run = <Value>(operation: (database: DynamicDatabase) => Effect.Effect<Value, unknown, unknown>): Promise<Value> =>
			runtime.runPromise(Effect.flatMap(databaseEffect, operation));

		const query: RelationQuery = (model, refinement, use) =>
			run((database) => use(refineRelation(modelRelation(database, mapModelName(model)), refinement)));

		const inTransaction = <Value>(callback: () => Promise<Value>): Effect.Effect<Value, unknown, unknown> =>
			Effect.flatMap(Effect.context<unknown>(), (services) =>
				Effect.tryPromise({
					catch: (error) => error,
					try: () => runtime.runWithServices(services, callback),
				}),
			);

		let factory: ReturnType<typeof createAdapterFactory>;
		factory = createAdapterFactory({
			adapter: makeRowAdapter(query, adapterOptions.usePlural ?? false),
			config: {
				adapterId: "effect-prisma",
				adapterName: "Effect Prisma",
				debugLogs: adapterOptions.debugLogs ?? false,
				supportsArrays: true,
				supportsBooleans: true,
				supportsDates: true,
				supportsJSON: true,
				supportsNumericIds: true,
				supportsUUIDs: true,
				transaction: (callback) => run((database) => database.transaction(inTransaction(() => callback(factory(authOptions))))),
			},
		});

		return factory(authOptions);
	};
}
