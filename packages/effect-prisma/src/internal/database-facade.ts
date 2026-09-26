import { type Context, Effect } from "effect";
import { type PrismaError, toPrismaError } from "../error.ts";
import { assertAvailableModelNames } from "./client-lifecycle.ts";
import type { DatabaseIdentifier, DatabaseService, DefaultModels } from "./database-types.ts";
import type { AnySqlContract, DatabaseExecutor } from "./executor.ts";
import { makeModelRelation } from "./relation-runtime.ts";
import { acquireTransaction, releaseTransaction, type TransactionOrm, withTransactionSemaphore } from "./transaction.ts";

export interface ActiveTransaction<Contract extends AnySqlContract, Identifier extends string> {
	readonly executor: DatabaseExecutor<DefaultModels<Contract>, Contract>;
	readonly facade: DatabaseService<Contract, Identifier>;
}

export interface FacadeScope<Contract extends AnySqlContract, Identifier extends string> {
	readonly activeTransaction: Context.Reference<ActiveTransaction<Contract, Identifier> | undefined>;
	readonly executors: WeakMap<DatabaseService<Contract, Identifier>, DatabaseExecutor<DefaultModels<Contract>, Contract>>;
	readonly service: Context.Service<DatabaseIdentifier<Contract, Identifier>, DatabaseService<Contract, Identifier>>;
}

// Prisma Next builds each namespace's model clients from the contract, so they are the contract's DefaultModels.
export function contractModels<Models extends object>(namespace: unknown): Models;
export function contractModels(namespace: unknown): unknown {
	return namespace;
}

// The facade serves `transaction` itself and a Relation for every other model name, matching DatabaseService.
function databaseFacade<Contract extends AnySqlContract, Identifier extends string>(facade: object): DatabaseService<Contract, Identifier>;
function databaseFacade(facade: object): unknown {
	return facade;
}

/**
 * Resolve the models of the single domain namespace from a namespaced ORM
 * client. Prisma Next namespaces PostgreSQL models under their schema and
 * SQLite models under the unbound namespace.
 */
export const namespaceModels = <Contract extends AnySqlContract, Models extends object>(
	contract: Contract,
	namespacedOrm: TransactionOrm<Contract>,
): Models => {
	const namespaces = Object.entries(contract.domain.namespaces);
	const [only] = namespaces;
	if (namespaces.length !== 1 || only === undefined) {
		throw new TypeError("Effect Prisma currently requires exactly one domain namespace");
	}
	const [name, namespace] = only;
	assertAvailableModelNames(Object.keys(namespace.models));
	return contractModels<Models>(Reflect.get(namespacedOrm, name));
};

export const runTransaction = <Contract extends AnySqlContract, Identifier extends string, A, E, R>(
	scope: FacadeScope<Contract, Identifier>,
	current: DatabaseExecutor<DefaultModels<Contract>, Contract>,
	currentFacade: DatabaseService<Contract, Identifier>,
	program: Effect.Effect<A, E, R>,
	release: typeof releaseTransaction,
	mode: "test" | "transaction",
	span: string,
): Effect.Effect<A, E | PrismaError, Exclude<R, DatabaseIdentifier<Contract, Identifier>>> => {
	if (!current.liveness.open) {
		return Effect.fail(toPrismaError({ code: current.liveness.closedCode }));
	}
	if (current.mode === "test" || (current.mode === "transaction" && mode === "transaction")) {
		return Effect.provideService(program, scope.service, currentFacade);
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
			(transactionOrm) => namespaceModels<Contract, DefaultModels<Contract>>(current.client.contract, transactionOrm),
			mode,
		),
		(resource) => {
			const transactionFacade = makeFacade(scope, resource.executor);
			return program.pipe(
				Effect.provideService(scope.service, transactionFacade),
				Effect.provideService(scope.activeTransaction, {
					executor: resource.executor,
					facade: transactionFacade,
				}),
			);
		},
		release,
	).pipe(Effect.withSpan(span, { kind: "client" }));

	return withTransactionSemaphore(current.transactionSemaphore, transaction);
};

export function makeFacade<Contract extends AnySqlContract, Identifier extends string>(
	scope: FacadeScope<Contract, Identifier>,
	current: DatabaseExecutor<DefaultModels<Contract>, Contract>,
): DatabaseService<Contract, Identifier> {
	let facade: DatabaseService<Contract, Identifier>;
	const resolveActiveTransaction = Effect.flatMap(scope.activeTransaction, (active) => {
		if (current.mode === "root") {
			return Effect.succeed(active ?? { executor: current, facade });
		}
		return active?.executor === current
			? Effect.succeed(active)
			: Effect.fail(
					toPrismaError({
						code: "RUNTIME.TRANSACTION_CONTEXT_MISMATCH",
					}),
				);
	});
	const resolveExecutor = Effect.suspend(() =>
		current.liveness.open ? Effect.map(resolveActiveTransaction, ({ executor }) => executor) : Effect.succeed(current),
	);
	const target: object = Object.create(null);
	Object.assign(target, {
		transaction: <A, E, R>(program: Effect.Effect<A, E, R> & (DatabaseIdentifier<Contract, Identifier> extends R ? unknown : never)) =>
			Effect.suspend(() => {
				if (!current.liveness.open) {
					return Effect.fail(toPrismaError({ code: current.liveness.closedCode }));
				}
				return Effect.flatMap(resolveActiveTransaction, (selected) =>
					runTransaction(scope, selected.executor, selected.facade, program, releaseTransaction, "transaction", "prisma.transaction"),
				);
			}),
	});
	facade = databaseFacade<Contract, Identifier>(
		new Proxy(target, {
			get(target, property, receiver) {
				if (Reflect.has(target, property)) {
					return Reflect.get(target, property, receiver);
				}
				if (typeof property !== "string") {
					return undefined;
				}
				return makeModelRelation(current, property, resolveExecutor);
			},
		}),
	);
	scope.executors.set(facade, current);
	return facade;
}
