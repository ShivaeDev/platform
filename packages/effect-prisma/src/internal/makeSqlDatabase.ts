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
import { type ActiveTransaction, type FacadeScope, makeFacade, runTransaction } from "./databaseFacade.ts";
import type { AnySqlContract, DatabaseExecutor } from "./executor.ts";
import { DatabaseTestingTypeId } from "./testing.ts";
import { releaseTestTransaction } from "./transaction.ts";

let activeTransactionReferenceSequence = 0;

export const makeSqlDatabase = <const TContract extends AnySqlContract, const TIdentifier extends string, TOptions>(
	identifier: DatabaseIdentifierLiteral<TIdentifier>,
	acquireExecutor: (options: TOptions) => Effect.Effect<DatabaseExecutor<DefaultModels<TContract>, TContract>, PrismaError>,
): SqlDatabase<TContract, TIdentifier, TOptions> => {
	if (identifier.startsWith(internalContextIdentifierPrefix)) {
		throw new TypeError("Database identifier uses a reserved internal namespace");
	}
	type Models = DefaultModels<TContract>;
	type DatabaseId = DatabaseIdentifier<TContract, TIdentifier>;

	const Service = Context.Service<DatabaseId, DatabaseService<TContract, TIdentifier>>(identifier);
	const scope: FacadeScope<TContract, TIdentifier> = {
		activeTransaction: Context.Reference<ActiveTransaction<TContract, TIdentifier> | undefined>(
			`${internalContextIdentifierPrefix}ActiveTransaction/${activeTransactionReferenceSequence++}`,
			{ defaultValue: () => undefined },
		),
		executors: new WeakMap(),
		service: Service,
	};
	function executorOf(facade: DatabaseService<TContract, TIdentifier>): Effect.Effect<DatabaseExecutor<Models, TContract>> {
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

	const layer = (layerOptions: TOptions): Layer.Layer<DatabaseId, PrismaError> => {
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
