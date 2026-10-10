import { Context, Effect, Layer } from "effect";
import {
	type DatabaseIdentifier,
	type DatabaseIdentifierLiteral,
	type DatabaseService,
	type DefaultModels,
	internalContextIdentifierPrefix,
	type SqlDatabase,
} from "#databaseTypes.ts";
import type { PrismaError } from "#error.ts";
import { type ActiveTransaction, type FacadeScope, makeFacade, runTransaction } from "./database-facade.ts";
import type { AnySqlContract, DatabaseExecutor } from "./executor.ts";
import { DatabaseTestingTypeId } from "./testing.ts";
import { releaseTestTransaction } from "./transaction.ts";

let activeTransactionReferenceSequence = 0;

export const makeSqlDatabase = <const Contract extends AnySqlContract, const Identifier extends string, Options>(
	identifier: DatabaseIdentifierLiteral<Identifier>,
	acquireExecutor: (options: Options) => Effect.Effect<DatabaseExecutor<DefaultModels<Contract>, Contract>, PrismaError>,
): SqlDatabase<Contract, Identifier, Options> => {
	if (identifier.startsWith(internalContextIdentifierPrefix)) {
		throw new TypeError("Database identifier uses a reserved internal namespace");
	}
	type Models = DefaultModels<Contract>;
	type DatabaseId = DatabaseIdentifier<Contract, Identifier>;

	const Service = Context.Service<DatabaseId, DatabaseService<Contract, Identifier>>(identifier);
	const scope: FacadeScope<Contract, Identifier> = {
		activeTransaction: Context.Reference<ActiveTransaction<Contract, Identifier> | undefined>(
			`${internalContextIdentifierPrefix}ActiveTransaction/${activeTransactionReferenceSequence++}`,
			{ defaultValue: () => undefined },
		),
		executors: new WeakMap(),
		service: Service,
	};
	function executorOf(facade: DatabaseService<Contract, Identifier>): Effect.Effect<DatabaseExecutor<Models, Contract>> {
		const executor = scope.executors.get(facade);
		return executor === undefined
			? Effect.die(new TypeError("The database service was not created by its database Layer"))
			: Effect.succeed(executor);
	}

	const withTestTransaction = <A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseId extends R ? unknown : never),
	): Effect.Effect<A, E | PrismaError, DatabaseId | Exclude<R, DatabaseId>> =>
		Effect.flatMap(Service, (facade) =>
			Effect.flatMap(executorOf(facade), (current) =>
				runTransaction(scope, current, facade, program, releaseTestTransaction, "test", "prisma.testTransaction"),
			),
		);

	const layer = (layerOptions: Options): Layer.Layer<DatabaseId, PrismaError> => {
		const acquire = Effect.acquireRelease(
			Effect.suspend(() => acquireExecutor(layerOptions)),
			(executor) => {
				executor.liveness.open = false;
				return Effect.promise(() => executor.client.close()).pipe(Effect.orDie);
			},
		);

		return Layer.effect(Service)(Effect.map(acquire, (executor) => makeFacade(scope, executor)));
	};

	return Object.assign(Service, {
		layer,
		[DatabaseTestingTypeId]: { withTestTransaction },
	});
};
