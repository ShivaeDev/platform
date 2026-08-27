import type { orm } from "@prisma-next/sql-orm-client";
import { Context, Effect, Layer } from "effect";
import { type PrismaError, toPrismaError } from "../error.js";
import type { Relation } from "../relation.js";
import { assertAvailableModelNames } from "./client-lifecycle.js";
import type { AnySqlContract, DatabaseExecutor } from "./executor.js";
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

type IsUnion<Value, Whole = Value> = Value extends unknown
	? [Whole] extends [Value]
		? false
		: true
	: never;

type IsSingletonString<Value extends string> =
	Record<never, never> extends Record<Value, never> ? false : true;

const internalContextIdentifierPrefix = "\0@shivaedev/effect-prisma/internal/";
let activeTransactionReferenceSequence = 0;

export type DatabaseIdentifierLiteral<Identifier extends string> = [
	Identifier,
] extends [`\0@shivaedev/effect-prisma/internal/${string}`]
	? never
	: string extends Identifier
		? never
		: true extends IsUnion<Identifier>
			? never
			: IsSingletonString<Identifier> extends true
				? Identifier
				: never;

export interface DatabaseIdentifier<
	Contract extends AnySqlContract,
	Identifier extends string,
> {
	readonly _contract: (contract: Contract) => Contract;
	readonly _databaseIdentifier: (identifier: Identifier) => Identifier;
}

type DatabaseModels<
	Contract extends AnySqlContract,
	Identifier extends string,
> = {
	readonly [Model in keyof DefaultModels<Contract>]: Relation<
		DefaultModels<Contract>[Model],
		Contract,
		Model & string,
		DatabaseIdentifier<Contract, Identifier>
	>;
};

export type DatabaseService<
	Contract extends AnySqlContract,
	Identifier extends string,
> = DatabaseModels<Contract, Identifier> & {
	transaction<A, E, R>(
		program: Effect.Effect<A, E, R> &
			(DatabaseIdentifier<Contract, Identifier> extends R ? unknown : never),
	): Effect.Effect<
		A,
		E | PrismaError,
		Exclude<R, DatabaseIdentifier<Contract, Identifier>>
	>;
};

/**
 * The driver-independent part of a database definition: the Context service
 * carrying the typed facade. Driver entrypoints add their own `layer` options.
 */
export interface DatabaseServiceHolder<
	Contract extends AnySqlContract,
	Identifier extends string,
> extends Context.Service<
		DatabaseIdentifier<Contract, Identifier>,
		DatabaseService<Contract, Identifier>
	> {}

export type AnyDatabase = Effect.Effect<unknown, never, unknown> & {
	readonly layer: (...arguments_: ReadonlyArray<never>) => Layer.Any;
};

export type DatabaseServiceOf<Database extends AnyDatabase> =
	Effect.Success<Database>;

export interface SqlDatabase<
	Contract extends AnySqlContract,
	Identifier extends string,
	Options,
> extends DatabaseServiceHolder<Contract, Identifier> {
	readonly layer: (
		options: Options,
	) => Layer.Layer<DatabaseIdentifier<Contract, Identifier>, PrismaError>;
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
 * Assemble the database service and its Layer around a driver-specific
 * executor acquisition.
 */
export const makeSqlDatabase = <
	const Contract extends AnySqlContract,
	const Identifier extends string,
	Options,
>(
	identifier: DatabaseIdentifierLiteral<Identifier>,
	acquireExecutor: (
		options: Options,
	) => Effect.Effect<
		DatabaseExecutor<DefaultModels<Contract>, Contract>,
		PrismaError
	>,
): SqlDatabase<Contract, Identifier, Options> => {
	if (identifier.startsWith(internalContextIdentifierPrefix)) {
		throw new TypeError(
			"Database identifier uses a reserved internal namespace",
		);
	}
	type Models = DefaultModels<Contract>;
	type DatabaseId = DatabaseIdentifier<Contract, Identifier>;

	const Service = Context.Service<
		DatabaseId,
		DatabaseService<Contract, Identifier>
	>(identifier);
	const executors = new WeakMap<
		DatabaseService<Contract, Identifier>,
		DatabaseExecutor<Models, Contract>
	>();
	type ActiveTransaction = {
		readonly executor: DatabaseExecutor<Models, Contract>;
		readonly facade: DatabaseService<Contract, Identifier>;
	};
	const ActiveTransaction = Context.Reference<ActiveTransaction | undefined>(
		`${internalContextIdentifierPrefix}ActiveTransaction/${activeTransactionReferenceSequence++}`,
		{ defaultValue: () => undefined },
	);
	const executorOf = (
		facade: DatabaseService<Contract, Identifier>,
	): Effect.Effect<DatabaseExecutor<Models, Contract>> => {
		const executor = executors.get(facade);
		return executor === undefined
			? Effect.die(
					new TypeError(
						"The database service was not created by its database Layer",
					),
				)
			: Effect.succeed(executor);
	};
	const runTransaction = <A, E, R>(
		current: DatabaseExecutor<Models, Contract>,
		currentFacade: DatabaseService<Contract, Identifier>,
		program: Effect.Effect<A, E, R>,
		release: typeof releaseTransaction,
		mode: "test" | "transaction",
		span: string,
	): Effect.Effect<A, E | PrismaError, Exclude<R, DatabaseId>> => {
		if (!current.liveness.open) {
			return Effect.fail(toPrismaError({ code: current.liveness.closedCode }));
		}
		if (
			current.mode === "test" ||
			(current.mode === "transaction" && mode === "transaction")
		) {
			return Effect.provideService(program, Service, currentFacade);
		}
		if (current.mode === "transaction") {
			return Effect.fail(
				toPrismaError({
					code: "RUNTIME.TEST_TRANSACTION_INSIDE_TRANSACTION_UNSUPPORTED",
				}),
			);
		}

		const transaction = Effect.acquireUseRelease(
			acquireTransaction(
				current,
				(transactionOrm) =>
					namespaceModels<Contract, Models>(
						current.client.contract,
						transactionOrm,
					),
				mode,
			),
			(resource) => {
				const transactionFacade = makeFacade(resource.executor);
				return program.pipe(
					Effect.provideService(Service, transactionFacade),
					Effect.provideService(ActiveTransaction, {
						executor: resource.executor,
						facade: transactionFacade,
					}),
				);
			},
			release,
		).pipe(Effect.withSpan(span, { kind: "client" }));

		return current.transactionSemaphore === undefined
			? transaction
			: current.transactionSemaphore.withPermit(transaction);
	};

	function makeFacade(
		current: DatabaseExecutor<Models, Contract>,
	): DatabaseService<Contract, Identifier> {
		let facade: DatabaseService<Contract, Identifier>;
		const resolveExecutor = Effect.suspend(() =>
			current.liveness.open
				? Effect.map(ActiveTransaction, (active) => active?.executor ?? current)
				: Effect.succeed(current),
		);
		const target = Object.assign(Object.create(null), {
			transaction: <A, E, R>(
				program: Effect.Effect<A, E, R> &
					(DatabaseId extends R ? unknown : never),
			) =>
				Effect.suspend(() => {
					if (!current.liveness.open) {
						return Effect.fail(
							toPrismaError({ code: current.liveness.closedCode }),
						);
					}
					return Effect.flatMap(ActiveTransaction, (active) => {
						const selected = active ?? { executor: current, facade };
						return runTransaction(
							selected.executor,
							selected.facade,
							program,
							releaseTransaction,
							"transaction",
							"prisma.transaction",
						);
					});
				}),
		}) as DatabaseService<Contract, Identifier>;
		facade = new Proxy(target, {
			get(target, property, receiver) {
				if (Reflect.has(target, property)) {
					return Reflect.get(target, property, receiver);
				}
				if (typeof property !== "string") {
					return undefined;
				}
				return makeModelRelation(current, property, resolveExecutor);
			},
		});
		executors.set(facade, current);
		return facade;
	}

	const withTestTransaction = <A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseId extends R ? unknown : never),
	): Effect.Effect<A, E | PrismaError, DatabaseId | Exclude<R, DatabaseId>> =>
		Effect.flatMap(Service, (facade) => {
			return Effect.flatMap(executorOf(facade), (current) =>
				runTransaction(
					current,
					facade,
					program,
					releaseTestTransaction,
					"test",
					"prisma.testTransaction",
				),
			);
		});

	const layer = (
		layerOptions: Options,
	): Layer.Layer<DatabaseId, PrismaError> => {
		const acquire = Effect.acquireRelease(
			Effect.suspend(() => acquireExecutor(layerOptions)),
			(executor) => {
				executor.liveness.open = false;
				return Effect.promise(() => executor.client.close()).pipe(Effect.orDie);
			},
		);

		return Layer.effect(Service)(Effect.map(acquire, makeFacade));
	};

	return Object.assign(Service, {
		layer,
		[DatabaseTestingTypeId]: { withTestTransaction },
	}) as SqlDatabase<Contract, Identifier, Options>;
};
