import { Data, Effect, Exit, Option, Semaphore } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { type QueryStorage, type QueryStorageOperation, QueryStorageProvider, type StoredQuery } from "#QueryStorage.ts";
import { queryRetention } from "#queryRetention.ts";
import { type OpenedQueryStorage, type StoredForm, storedQueries } from "#storedQueries.ts";

export const STORED_WRITE_WINDOW = "1 second";
const STORED_BYTES = 5_000_000;

class QueryStorageUnavailable extends Data.TaggedError("QueryStorageUnavailable")<{ readonly cause: unknown }> {}

function operation<A>(run: () => QueryStorageOperation<A>): Effect.Effect<A, QueryStorageUnavailable> {
	return Effect.suspend(() => {
		const value = run();
		return Effect.isEffect(value) ? value : Effect.succeed(value);
	}).pipe(Effect.catchCause((cause) => Effect.fail(new QueryStorageUnavailable({ cause }))));
}

// Writes from one generation, the next generation's read and a wipe reach the same storage, so they run in the order they were asked for.
const queues = new WeakMap<QueryStorage, Semaphore.Semaphore>();
function serial(storage: QueryStorage) {
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
	return yield* serial(storage)(operation(() => storage.getAll(user))).pipe(
		Effect.map((entries): OpenedQueryStorage | undefined => ({ entries, storage, user })),
		Effect.catchTag("QueryStorageUnavailable", () => Effect.succeed(undefined)),
	);
});

export const clearStoredQueries = Effect.fn("Contract.clearStoredQueries")(function* (user?: string) {
	const storage = (yield* QueryStorageProvider)();
	yield* serial(storage)(operation(() => storage.clear(user))).pipe(Effect.catchTag("QueryStorageUnavailable", () => Effect.void));
});

export const queryPersistence = Atom.keepAlive(
	Atom.make((get) => {
		const opened = get(storedQueries);
		if (opened === undefined) {
			return undefined;
		}
		const { storage, user } = opened;
		const registry = get.registry;
		const seeds = new Map(opened.entries.map((entry) => [entry.key, entry.value]));
		const kept = new Map<string, number>();
		let used = 0;
		for (const entry of [...opened.entries].sort((left, right) => left.used - right.used)) {
			kept.set(entry.key, entry.key.length + entry.value.length);
			used = Math.max(used, entry.used);
		}
		const written = new Map<string, StoredQuery>();
		const removed = new Set<string>();
		let active = true;
		let stop: (() => void) | undefined;
		get.addFinalizer(() => {
			active = false;
			stop?.();
		});
		function flush() {
			stop?.();
			stop = undefined;
			const entries = [...written.values()];
			const keys = [...removed];
			written.clear();
			removed.clear();
			if (!active || (entries.length === 0 && keys.length === 0)) {
				return;
			}
			Effect.runFork(
				serial(storage)(
					Effect.all([
						entries.length === 0 ? Effect.void : operation(() => storage.setItems(user, entries)),
						keys.length === 0 ? Effect.void : operation(() => storage.removeItems(user, keys)),
					]),
				).pipe(Effect.catchTag("QueryStorageUnavailable", () => Effect.void)),
			);
		}
		function forget(key: string) {
			kept.delete(key);
			written.delete(key);
			removed.add(key);
		}
		function schedule(runtime: Atom.AtomRuntime<unknown, unknown>) {
			if (stop !== undefined) {
				return;
			}
			const timer = Atom.make((context) => {
				const services = context(runtime);
				if (AsyncResult.isSuccess(services)) {
					context.addFinalizer(Effect.runCallbackWith(services.value)(Effect.sleep(STORED_WRITE_WINDOW).pipe(Effect.andThen(Effect.sync(flush)))));
				}
			}).pipe(Atom.setIdleTTL(0));
			stop = registry.mount(timer);
		}
		function evict() {
			const { capacity = 100, storedBytes = STORED_BYTES } = registry.get(queryRetention);
			let bytes = [...kept.values()].reduce((total, size) => total + size, 0);
			for (const [key, size] of kept) {
				if (kept.size <= capacity && bytes <= storedBytes) {
					break;
				}
				bytes -= size;
				forget(key);
			}
		}
		function run<A>(runtime: Atom.AtomRuntime<unknown, unknown>, effect: Effect.Effect<A, unknown, unknown>): Option.Option<A> {
			const services = registry.get(runtime);
			if (!AsyncResult.isSuccess(services)) {
				return Option.none();
			}
			const exit = Effect.runSyncExitWith(services.value)(effect);
			return Exit.isSuccess(exit) ? Option.some(exit.value) : Option.none();
		}
		function drop(key: string, runtime: Atom.AtomRuntime<unknown, unknown>) {
			seeds.delete(key);
			if (kept.has(key) || written.has(key)) {
				forget(key);
				schedule(runtime);
			}
		}
		return {
			drop: <A>(form: StoredForm<A>, runtime: Atom.AtomRuntime<unknown, unknown>) => {
				Option.map(run(runtime, form.key), (key) => drop(key, runtime));
			},
			flush,
			restore: <A>(form: StoredForm<A>, runtime: Atom.AtomRuntime<unknown, unknown>): Option.Option<A> =>
				Option.flatMap(run(runtime, form.key), (key) => {
					const raw = seeds.get(key);
					seeds.delete(key);
					if (raw === undefined) {
						return Option.none();
					}
					const decoded = run(runtime, form.decode(raw));
					if (Option.isNone(decoded)) {
						drop(key, runtime);
					}
					return decoded;
				}),
			save: <A>(form: StoredForm<A>, value: A, runtime: Atom.AtomRuntime<unknown, unknown>) => {
				const stored = Option.all({ encoded: run(runtime, form.encode(value)), key: run(runtime, form.key) });
				Option.map(stored, ({ encoded, key }) => {
					used += 1;
					kept.delete(key);
					kept.set(key, key.length + encoded.length);
					written.set(key, { key, used, value: encoded });
					removed.delete(key);
					evict();
					schedule(runtime);
				});
			},
		};
	}),
);
