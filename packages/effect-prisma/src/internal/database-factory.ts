import type { orm } from "@prisma-next/sql-orm-client";
import { Context, Effect, Layer } from "effect";
import type { PrismaError } from "../error.js";
import type { Relation } from "../relation.js";
import { assertAvailableModelNames } from "./client-lifecycle.js";
import type {
	AnySqlContract,
	DatabaseExecutor,
	ExecutorIdentifier,
} from "./executor.js";
import { makeModelRelation } from "./relation-runtime.js";
import { DatabaseTestingTypeId } from "./testing.js";
import {
	acquireTransaction,
	releaseTestTransaction,
	releaseTransaction,
	type TransactionOrm,
} from "./transaction.js";

type OrmFor<Contract extends AnySqlContract> = ReturnType<typeof orm<Contract>>;
type DefaultNamespaceId<Contract extends AnySqlContract> =
	"__unbound__" extends keyof OrmFor<Contract>
		? "__unbound__"
		: "public" extends keyof OrmFor<Contract>
			? "public"
			: keyof OrmFor<Contract>;
export type DefaultModels<Contract extends AnySqlContract> =
	OrmFor<Contract>[DefaultNamespaceId<Contract>] extends infer Models extends
		object
		? Models
		: never;

export interface DatabaseIdentifier<Contract extends AnySqlContract> {
	readonly _contract: Contract;
	readonly _databaseIdentifier: unique symbol;
}

type DatabaseModels<Contract extends AnySqlContract, Requirement> = {
	readonly [Model in keyof DefaultModels<Contract>]: Relation<
		DefaultModels<Contract>[Model],
		Requirement,
		Contract,
		Model & string
	>;
};

export type DatabaseService<
	Contract extends AnySqlContract,
	Requirement,
> = DatabaseModels<Contract, Requirement> & {
	transaction<A, E, R>(
		program: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | PrismaError, R | Requirement>;
};

/**
 * The driver-independent part of a database definition: the Context service
 * carrying the typed facade. Driver entrypoints add their own `layer` options.
 */
export interface DatabaseServiceHolder<
	Contract extends AnySqlContract,
	Requirement = ExecutorIdentifier<DefaultModels<Contract>>,
> extends Context.Service<
		DatabaseIdentifier<Contract>,
		DatabaseService<Contract, Requirement>
	> {}

export type AnyDatabase = Effect.Effect<unknown, never, unknown> & {
	readonly layer: (...arguments_: ReadonlyArray<never>) => Layer.Any;
};

export type DatabaseRequirement<Database> =
	Database extends DatabaseServiceHolder<AnySqlContract, infer Requirement>
		? Requirement
		: never;

export type DatabaseServiceOf<Database extends AnyDatabase> =
	Effect.Success<Database>;

export interface SqlDatabase<Contract extends AnySqlContract, Options>
	extends DatabaseServiceHolder<Contract> {
	readonly layer: (
		options: Options,
	) => Layer.Layer<
		DatabaseIdentifier<Contract> | ExecutorIdentifier<DefaultModels<Contract>>,
		PrismaError
	>;
}

/**
 * Resolve the models of the single domain namespace from a namespaced ORM
 * client. Prisma Next namespaces PostgreSQL models under their schema and
 * SQLite models under the unbound namespace.
 */
export const namespaceModels = <
	Contract extends AnySqlContract,
	Models extends object,
>(
	contract: Contract,
	namespacedOrm: TransactionOrm<Contract>,
): Models => {
	const namespaces = Object.keys(contract.domain.namespaces);
	if (namespaces.length !== 1 || namespaces[0] === undefined) {
		throw new TypeError(
			"Effect Prisma currently requires exactly one domain namespace",
		);
	}
	assertAvailableModelNames(
		Object.keys(contract.domain.namespaces[namespaces[0]].models),
	);
	return Reflect.get(namespacedOrm, namespaces[0]) as Models;
};

/**
 * Assemble the database service, its Executor service, and its Layer around a
 * driver-specific executor acquisition.
 */
export const makeSqlDatabase = <const Contract extends AnySqlContract, Options>(
	identifier: string,
	acquireExecutor: (
		options: Options,
	) => Effect.Effect<
		DatabaseExecutor<DefaultModels<Contract>, Contract>,
		PrismaError
	>,
): SqlDatabase<Contract, Options> => {
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

	const scopedTransaction =
		(release: typeof releaseTransaction, span: string) =>
		<A, E, R>(
			program: Effect.Effect<A, E, R>,
		): Effect.Effect<A, E | PrismaError, R | ExecutorId> =>
			Effect.flatMap(Executor, (current) => {
				if (current.transactional) {
					return program;
				}

				return Effect.acquireUseRelease(
					acquireTransaction(current, (transactionOrm) =>
						namespaceModels<Contract, Models>(
							current.client.contract,
							transactionOrm,
						),
					),
					(resource) =>
						program.pipe(Effect.provideService(Executor, resource.executor)),
					release,
				).pipe(Effect.withSpan(span, { kind: "client" }));
			});

	const transaction = scopedTransaction(
		releaseTransaction,
		"prisma.transaction",
	);
	const withTestTransaction = scopedTransaction(
		releaseTestTransaction,
		"prisma.testTransaction",
	);

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
		layerOptions: Options,
	): Layer.Layer<DatabaseId | ExecutorId, PrismaError> => {
		const acquire = Effect.acquireRelease(
			Effect.suspend(() => acquireExecutor(layerOptions)),
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
	}) as SqlDatabase<Contract, Options>;
};
