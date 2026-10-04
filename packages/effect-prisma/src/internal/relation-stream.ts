import { Effect, Stream } from "effect";
import { isPrismaFailure, type PrismaError, toPrismaError } from "#error.ts";
import { hasMethod, invokeMethod, isAsyncIterable } from "./dynamic.ts";
import type { AnyPostgresContract, DatabaseExecutor } from "./executor.ts";
import { fromPrismaPromise } from "./promise.ts";
import { executeQuery } from "./query-execution.ts";
import { type RelationRecipe, replayRecipe } from "./recipe.ts";

const collectRows = (iterable: AsyncIterable<unknown>): Effect.Effect<unknown[], PrismaError> =>
	fromPrismaPromise(async () => {
		const rows: unknown[] = [];
		for await (const row of iterable) {
			rows.push(row);
		}
		return rows;
	});

export const makeRelationStream = <Models extends object, Contract extends AnyPostgresContract>(
	resolveExecutor: Effect.Effect<DatabaseExecutor<Models, Contract>, PrismaError>,
	recipe: RelationRecipe,
): Stream.Stream<unknown, PrismaError> =>
	Stream.unwrap(
		Effect.flatMap(resolveExecutor, (executor) =>
			executeQuery(
				executor,
				Effect.sync(() => {
					const collection = replayRecipe(executor.models, recipe, executor.identity, executor.transactionIdentity);
					const iterable = hasMethod(collection, "all") ? invokeMethod(collection, "all", []) : undefined;
					if (!isAsyncIterable(iterable)) {
						throw new TypeError("Only collection Relations can be streamed");
					}

					if (executor.mode === "root") {
						return Stream.fromAsyncIterable(iterable, (error) => error).pipe(
							Stream.catch((error) => (isPrismaFailure(error) ? Stream.fail(toPrismaError(error)) : Stream.die(error))),
						);
					}

					const buffered = executeQuery(executor, collectRows(iterable));

					return Stream.unwrap(Effect.map(buffered, (rows) => Stream.fromIterable(rows)));
				}),
			),
		),
	);
