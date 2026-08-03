import type { Context } from "effect";
import { Effect, Stream } from "effect";
import { isPrismaFailure, type PrismaError, toPrismaError } from "../error.js";
import type {
	AnyPostgresContract,
	DatabaseExecutor,
	ExecutorIdentifier,
} from "./executor.js";
import { fromPrismaPromise } from "./promise.js";
import { executeQuery } from "./query-execution.js";
import { type RelationRecipe, replayRecipe } from "./recipe.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;

export const makeRelationStream = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	executorService: Context.Service<
		ExecutorIdentifier<Models>,
		DatabaseExecutor<Models, Contract>
	>,
	recipe: RelationRecipe,
): Stream.Stream<unknown, PrismaError, ExecutorIdentifier<Models>> =>
	Stream.unwrap(
		Effect.map(executorService, (executor) => {
			const collection = replayRecipe(executor.models, recipe);
			if (
				typeof collection !== "object" ||
				collection === null ||
				typeof Reflect.get(collection, "all") !== "function"
			) {
				throw new TypeError("Only collection Relations can be streamed");
			}
			const iterable = Reflect.apply(
				Reflect.get(collection, "all") as AnyFunction,
				collection,
				[],
			) as AsyncIterable<unknown>;

			if (executor.querySemaphore === undefined) {
				return Stream.fromAsyncIterable(iterable, (error) => error).pipe(
					Stream.catch((error) =>
						isPrismaFailure(error)
							? Stream.fail(toPrismaError(error))
							: Stream.die(error),
					),
				);
			}

			const buffered = executeQuery(
				executor,
				fromPrismaPromise(async () => {
					const rows: Array<unknown> = [];
					for await (const row of iterable) {
						rows.push(row);
					}
					return rows;
				}),
			);

			return Stream.unwrap(
				Effect.map(buffered, (rows) => Stream.fromIterable(rows)),
			);
		}),
	);
