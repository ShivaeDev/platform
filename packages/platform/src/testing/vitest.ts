import type { Vitest } from "@effect/vitest";
import {
	type AnyDatabase,
	type DatabaseRequirement,
	type DatabaseService,
	withTestTransaction,
} from "@shivaedev/effect-prisma/testing";
import {
	type CallerOptions,
	type CallerResult,
	type EffectCallerFactory,
	makeTrpcHarnessIt,
} from "@shivaedev/effect-trpc/testing";
import { Effect, type Layer } from "effect";
import type {
	MakePlatformItOptions,
	PlatformHarness,
	PlatformIt,
} from "./types.js";

export const makePlatformIt =
	<const Database extends AnyDatabase>(database: Database) =>
	<
		CreateCaller extends (...arguments_: never[]) => object,
		Provided,
		LayerError,
		Extension extends object = Record<never, never>,
	>(
		options: MakePlatformItOptions<
			Database,
			CreateCaller,
			Provided,
			LayerError,
			Extension
		> & {
			readonly layer: Layer.Layer<
				Provided | DatabaseRequirement<Database> | Effect.Services<Database>,
				LayerError
			>;
		},
	): PlatformIt<
		PlatformHarness<
			Database,
			CallerOptions<CreateCaller>,
			CallerResult<CreateCaller>,
			Extension
		>,
		Provided | DatabaseRequirement<Database> | Effect.Services<Database>
	> => {
		type Options = CallerOptions<CreateCaller>;
		type Caller = CallerResult<CreateCaller>;
		type Services =
			| Provided
			| DatabaseRequirement<Database>
			| Effect.Services<Database>;
		type Harness = PlatformHarness<Database, Options, Caller, Extension>;

		const trpcIt = makeTrpcHarnessIt<
			CreateCaller,
			Layer.Layer<Services, LayerError>,
			Harness
		>({
			adapter: options.adapter,
			createCaller: options.createCaller,
			layer: options.layer,
			around: (effect) => withTestTransaction(database, effect),
			makeHarness: (
				trpc: EffectCallerFactory<Options, Caller>,
				context,
			): Effect.Effect<Harness, unknown, Services> =>
				Effect.gen(function* () {
					const databaseEffect = database as unknown as Effect.Effect<
						DatabaseService<Database>,
						never,
						Effect.Services<Database>
					>;
					const db = yield* databaseEffect;
					const extension = options.extend
						? yield* options.extend({ db, trpc }, context)
						: ({} as Extension);
					return { ...extension, db, trpc } as Harness;
				}) as Effect.Effect<Harness, unknown, Services>,
		});

		return new Proxy(trpcIt, {
			get(target, property, receiver) {
				if (property === "effectApp") {
					return trpcIt.effectTRPC;
				}
				return Reflect.get(target, property, receiver);
			},
		}) as unknown as Vitest.Methods & {
			readonly effectApp: typeof trpcIt.effectTRPC;
		} as PlatformIt<Harness, Services>;
	};
