import { Effect, Layer } from "effect";
import { indexedQueryRows } from "#adapters/indexedQueryRows.ts";
import { type QueryStorage, QueryStorageProvider } from "#QueryStorage.ts";

const rows = indexedQueryRows(() => ({ factory: globalThis.indexedDB, keyRange: globalThis.IDBKeyRange }));

const storage: QueryStorage = {
	clear: (user) => Effect.tryPromise(() => rows.clear(user)),
	getAll: (user) => Effect.tryPromise(() => rows.getAll(user)),
	removeItems: (user, keys) => Effect.tryPromise(() => rows.removeItems(user, keys)),
	setItems: (user, entries) => Effect.tryPromise(() => rows.setItems(user, entries)),
};

export const browserQueryStorage = Layer.succeed(QueryStorageProvider, () => storage);
