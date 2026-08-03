import postgres, {
	type PostgresClient,
	type PostgresOptionsBase,
} from "@prisma-next/postgres/runtime";
import { Context, Effect, Layer, Redacted } from "effect";
import type { PrismaError } from "./error.js";
import {
	acquireConnectedClient,
	assertAvailableModelNames,
} from "./internal/client-lifecycle.js";
import type {
	AnyPostgresContract,
	DatabaseExecutor,
	ExecutorIdentifier,
} from "./internal/executor.js";
import { fromPrismaPromise } from "./internal/promise.js";
import { makeModelRelation } from "./internal/relation-runtime.js";
import { DatabaseTestingTypeId } from "./internal/testing.js";
import {
	acquireTransaction,
	releaseTestTransaction,
	releaseTransaction,
} from "./internal/transaction.js";
import type { Relation } from "./relation.js";

type ClientFor<Contract extends AnyPostgresContract> = PostgresClient<Contract>;
type OrmFor<Contract extends AnyPostgresContract> = ClientFor<Contract>["orm"];
type DefaultNamespaceId<Contract extends AnyPostgresContract> =
	"__unbound__" extends keyof OrmFor<Contract>
		? "__unbound__"
		: "public" extends keyof OrmFor<Contract>
			? "public"
			: keyof OrmFor<Contract>;
type DefaultModels<Contract extends AnyPostgresContract> =
	OrmFor<Contract>[DefaultNamespaceId<Contract>] extends infer Models extends
		object
		? Models
		: never;

interface DatabaseIdentifier<Contract extends AnyPostgresContract> {
	readonly _contract: Contract;
	readonly _databaseIdentifier: unique symbol;
}

type DatabaseModels<Contract extends AnyPostgresContract, Requirement> = {
	readonly [Model in keyof DefaultModels<Contract>]: Relation<
		DefaultModels<Contract>[Model],
		Requirement,
		Contract,
		Model & string
	>;
};

export type DatabaseService<
	Contract extends AnyPostgresContract,
	Requirement,
> = DatabaseModels<Contract, Requirement> & {
	transaction<A, E, R>(
		program: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | PrismaError, R | Requirement>;
};

export interface DatabaseLayerOptions extends PostgresOptionsBase {
	readonly url: string | Redacted.Redacted<string>;
}

type DatabaseFactoryOptions<Contract extends AnyPostgresContract> =
	| {
			readonly contract: Contract;
			readonly contractJson?: never;
	  }
	| {
			readonly contractJson: unknown;
			readonly contract?: never;
	  };

export interface DatabaseDefinition<
	Contract extends AnyPostgresContract,
	Requirement = ExecutorIdentifier<DefaultModels<Contract>>,
> extends Context.Service<
		DatabaseIdentifier<Contract>,
		DatabaseService<Contract, Requirement>
	> {
	readonly layer: (
		options: DatabaseLayerOptions,
	) => Layer.Layer<DatabaseIdentifier<Contract> | Requirement, PrismaError>;
}

export type AnyDatabase = Effect.Effect<unknown, never, unknown> & {
	readonly layer: (...arguments_: ReadonlyArray<never>) => Layer.Any;
};

export type DatabaseRequirement<Database> =
	Database extends DatabaseDefinition<AnyPostgresContract, infer Requirement>
		? Requirement
		: never;

export type DatabaseServiceOf<Database extends AnyDatabase> =
	Effect.Success<Database>;

const defaultModels = <
	Contract extends AnyPostgresContract,
	Models extends object,
>(
	client: Pick<PostgresClient<Contract>, "contract" | "orm">,
): Models => {
	const namespaces = Object.keys(client.contract.domain.namespaces);
	if (namespaces.length !== 1 || namespaces[0] === undefined) {
		throw new TypeError(
			"Effect Prisma currently requires exactly one domain namespace",
		);
	}
	assertAvailableModelNames(
		Object.keys(client.contract.domain.namespaces[namespaces[0]].models),
	);
	return Reflect.get(client.orm, namespaces[0]) as Models;
};

export const makeDatabase = <const Contract extends AnyPostgresContract>(
	identifier: string,
	options: DatabaseFactoryOptions<Contract>,
): DatabaseDefinition<Contract> => {
	type Models = DefaultModels<Contract>;
	type ExecutorId = ExecutorIdentifier<Models>;
	type DatabaseId = DatabaseIdentifier<Contract>;

	const Executor = Context.Service<
		ExecutorId,
		DatabaseExecutor<Models, Contract>
	>(`${identifier}/Executor`);
	const Service = Context.Service<
		DatabaseId,
		DatabaseService<Contract, ExecutorId>
	>(identifier);

	const transaction = <A, E, R>(
		program: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | PrismaError, R | ExecutorId> =>
		Effect.flatMap(Executor, (current) => {
			if (current.transactional) {
				return program;
			}

			return Effect.acquireUseRelease(
				acquireTransaction(current, (transactionOrm) =>
					defaultModels<Contract, Models>({
						contract: current.client.contract,
						orm: transactionOrm,
					}),
				),
				(resource) =>
					program.pipe(Effect.provideService(Executor, resource.executor)),
				releaseTransaction,
			).pipe(Effect.withSpan("prisma.transaction", { kind: "client" }));
		});

	const withTestTransaction = <A, E, R>(
		program: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | PrismaError, R | ExecutorId> =>
		Effect.flatMap(Executor, (current) => {
			if (current.transactional) {
				return program;
			}

			return Effect.acquireUseRelease(
				acquireTransaction(current, (transactionOrm) =>
					defaultModels<Contract, Models>({
						contract: current.client.contract,
						orm: transactionOrm,
					}),
				),
				(resource) =>
					program.pipe(Effect.provideService(Executor, resource.executor)),
				releaseTestTransaction,
			).pipe(Effect.withSpan("prisma.testTransaction", { kind: "client" }));
		});

	const facade = new Proxy(
		Object.assign(Object.create(null), {
			transaction,
		}) as DatabaseService<Contract, ExecutorId>,
		{
			get(target, property, receiver) {
				if (Reflect.has(target, property)) {
					return Reflect.get(target, property, receiver);
				}
				if (typeof property !== "string") {
					return undefined;
				}
				return makeModelRelation(Executor, property);
			},
		},
	);

	const layer = (
		layerOptions: DatabaseLayerOptions,
	): Layer.Layer<DatabaseId | ExecutorId, PrismaError> => {
		const acquire = Effect.acquireRelease(
			Effect.suspend(() => {
				const clientOptions = {
					url:
						typeof layerOptions.url === "string"
							? layerOptions.url
							: Redacted.value(layerOptions.url),
					extensions: layerOptions.extensions,
					middleware: layerOptions.middleware,
					poolOptions: layerOptions.poolOptions,
					verifyMarker: layerOptions.verifyMarker,
				};
				const client =
					options.contract === undefined
						? postgres<Contract>({
								...clientOptions,
								contractJson: options.contractJson,
							})
						: postgres<Contract>({
								...clientOptions,
								contract: options.contract,
							});

				return fromPrismaPromise(() =>
					acquireConnectedClient(client, () => ({
						client,
						models: defaultModels<Contract, Models>(client),
						querySemaphore: undefined,
						transactional: false,
					})),
				);
			}),
			(executor) =>
				Effect.promise(() => executor.client.close()).pipe(Effect.orDie),
		);

		return Layer.effectContext(
			Effect.map(acquire, (executor) =>
				Context.make(Executor, executor).pipe(Context.add(Service, facade)),
			),
		);
	};

	return Object.assign(Service, {
		layer,
		[DatabaseTestingTypeId]: { withTestTransaction },
	}) as DatabaseDefinition<Contract>;
};
