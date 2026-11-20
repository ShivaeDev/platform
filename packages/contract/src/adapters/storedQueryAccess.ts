import { Data, Effect, Semaphore } from "effect";
import { type QueryStorage, type QueryStorageOperation, QueryStorageProvider } from "#QueryStorage.ts";
import type { OpenedQueryStorage } from "#storedQueries.ts";

export class QueryStorageUnavailable extends Data.TaggedError("QueryStorageUnavailable")<{ readonly cause: unknown }> {}

export function storageOperation<A>(run: () => QueryStorageOperation<A>): Effect.Effect<A, QueryStorageUnavailable> {
	return Effect.suspend(() => {
		const value = run();
		return Effect.isEffect(value) ? value : Effect.succeed(value);
	}).pipe(Effect.catchCause((cause) => Effect.fail(new QueryStorageUnavailable({ cause }))));
}

// Writes from one generation, the next generation's read and a wipe reach the same storage, so they run in the order they were asked for.
const queues = new WeakMap<QueryStorage, Semaphore.Semaphore>();
export function storageQueue(storage: QueryStorage) {
	let queue = queues.get(storage);
	if (queue === undefined) {
		queue = Semaphore.makeUnsafe(1);
		queues.set(storage, queue);
	}
	return queue.withPermit;
}

// Storage the browser refuses leaves this generation without stored results rather than failing it.
export const openStoredQueries = Effect.fn("Contract.openStoredQueries")(function* (user: string) {
	const storage = (yield* QueryStorageProvider)();
	return yield* storageQueue(storage)(storageOperation(() => storage.getAll(user))).pipe(
		Effect.map((entries): OpenedQueryStorage | undefined => ({ entries, storage, user })),
		Effect.catchTag("QueryStorageUnavailable", () => Effect.succeed(undefined)),
	);
});

export const clearStoredQueries = Effect.fn("Contract.clearStoredQueries")(function* (user?: string) {
	const storage = (yield* QueryStorageProvider)();
	yield* storageQueue(storage)(storageOperation(() => storage.clear(user))).pipe(Effect.catchTag("QueryStorageUnavailable", () => Effect.void));
});
