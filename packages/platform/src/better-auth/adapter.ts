import type { AnyDatabase, DatabaseServiceOf } from "@shivaedev/effect-prisma";
import type { BetterAuthOptions, DBAdapterInstance, Where } from "better-auth";
import { type CustomAdapter, createAdapterFactory } from "better-auth/adapters";
import { Effect, Option } from "effect";
import type { PlatformRuntime } from "../runtime/types.js";
import { type DynamicRelation, refineRelation } from "./relation.js";

type CleanedWhere = Required<Where>;
type FindOneInput = Parameters<CustomAdapter["findOne"]>[0];
type FindManyInput = Parameters<CustomAdapter["findMany"]>[0];
type UpdateInput<Value> = {
	readonly model: string;
	readonly update: Value;
	readonly where: CleanedWhere[];
};

export interface EffectPrismaAdapterOptions {
	readonly debugLogs?: boolean;
	/** Map Better Auth model names to Prisma contract model names. */
	readonly modelName?: (model: string) => string;
	readonly usePlural?: boolean;
}

interface DynamicDatabase<Requirements> {
	readonly transaction: <A, E, R>(
		program: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E | unknown, R | Requirements>;
	readonly [model: string]: DynamicRelation<Requirements> | unknown;
}

const modelRelation = <Requirements>(
	database: DynamicDatabase<Requirements>,
	model: string,
	mapModelName: (model: string) => string,
): DynamicRelation<Requirements> =>
	Reflect.get(database, mapModelName(model)) as DynamicRelation<Requirements>;

const defaultModelName = (model: string): string =>
	model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`;

const rejectJoin = (join: unknown): void => {
	if (join !== undefined) {
		throw new TypeError(
			"The Effect Prisma Better Auth adapter does not support experimental native joins",
		);
	}
};

export const effectPrismaAdapter =
	<Database extends AnyDatabase, Services, BuildError>(
		databaseTag: Database,
		runtime: PlatformRuntime<Services, BuildError>,
		adapterOptions: EffectPrismaAdapterOptions = {},
	): DBAdapterInstance =>
	(authOptions: BetterAuthOptions) => {
		const mapModelName = adapterOptions.modelName ?? defaultModelName;
		const databaseEffect = databaseTag as Effect.Effect<
			DatabaseServiceOf<Database>,
			never,
			Services
		>;

		const run = <Value>(
			operation: (
				database: DynamicDatabase<Services>,
			) => Effect.Effect<Value, unknown, Services>,
		): Promise<Value> =>
			runtime.runPromise(
				Effect.flatMap(databaseEffect, (database) =>
					operation(database as DynamicDatabase<Services>),
				),
			);

		let factory: ReturnType<typeof createAdapterFactory>;
		factory = createAdapterFactory({
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
				transaction: (callback) =>
					run((database) =>
						database.transaction(
							Effect.flatMap(Effect.context<Services>(), (services) =>
								Effect.tryPromise({
									try: () =>
										runtime.runWithServices(services, () =>
											callback(factory(authOptions)),
										),
									catch: (error) => error,
								}),
							),
						),
					),
			},
			adapter: ({ debugLog, getFieldAttributes }) => ({
				create: async ({ data, model, select }) => {
					debugLog("create", { model });
					return (await run((database) =>
						refineRelation(modelRelation(database, model, mapModelName), {
							select,
						}).create(data),
					)) as typeof data;
				},
				findOne: async <Value>({
					join,
					model,
					select,
					where,
				}: FindOneInput) => {
					rejectJoin(join);
					return (await run((database) =>
						Effect.map(
							refineRelation(modelRelation(database, model, mapModelName), {
								select,
								where,
							}).first(),
							Option.getOrNull,
						),
					)) as Value | null;
				},
				findMany: async <Value>({
					join,
					limit,
					model,
					offset,
					select,
					sortBy,
					where,
				}: FindManyInput) => {
					rejectJoin(join);
					return (await run(
						(database) =>
							refineRelation(modelRelation(database, model, mapModelName), {
								limit,
								offset,
								select,
								sortBy,
								where,
							}) as unknown as Effect.Effect<
								ReadonlyArray<Record<string, unknown>>,
								unknown,
								Services
							>,
					)) as Value[];
				},
				update: async <Value>({ model, update, where }: UpdateInput<Value>) => {
					if (where.length === 0) return null;
					const hasUniqueCondition = where.some(
						(condition) =>
							condition.connector !== "OR" &&
							condition.operator === "eq" &&
							condition.mode !== "insensitive" &&
							(condition.field === "id" ||
								getFieldAttributes({
									field: condition.field,
									model,
								}).unique === true),
					);
					return (await run((database) => {
						const relation = refineRelation(
							modelRelation(database, model, mapModelName),
							{ where },
						);
						return hasUniqueCondition
							? relation.update(update as Record<string, unknown>)
							: Effect.map(
									relation.updateAll(update as Record<string, unknown>),
									(rows) => rows[0] ?? null,
								);
					})) as Value | null;
				},
				updateMany: ({ model, update, where }) =>
					run((database) =>
						Effect.map(
							refineRelation(modelRelation(database, model, mapModelName), {
								where,
							}).updateAll(update),
							(rows) => rows.length,
						),
					),
				delete: ({ model, where }) => {
					const hasId = where.some(
						(condition) =>
							condition.connector !== "OR" &&
							condition.field === "id" &&
							condition.operator === "eq",
					);
					return run((database) => {
						const relation = refineRelation(
							modelRelation(database, model, mapModelName),
							{ where },
						);
						return hasId
							? Effect.asVoid(relation.delete())
							: Effect.asVoid(relation.deleteAll());
					});
				},
				deleteMany: ({ model, where }) =>
					run((database) =>
						Effect.map(
							refineRelation(modelRelation(database, model, mapModelName), {
								where,
							}).deleteAll(),
							(rows) => rows.length,
						),
					),
				count: ({ model, where }) =>
					run((database) =>
						refineRelation(modelRelation(database, model, mapModelName), {
							where: where as CleanedWhere[] | undefined,
						}).count(),
					),
				options: {
					usePlural: adapterOptions.usePlural ?? false,
				},
			}),
		});

		return factory(authOptions);
	};
