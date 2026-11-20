import { Effect, Layer } from "effect";
import { type QueryStorage, QueryStorageProvider, type StoredQuery } from "#QueryStorage.ts";

const DATABASE = "@shivaedev/contract/queries";
const RESULTS = "results";

interface StoredRow extends StoredQuery {
	readonly user: string;
}

let opened: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
	opened ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = globalThis.indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(RESULTS, { keyPath: ["user", "key"] });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	}).catch((error: unknown) => {
		opened = undefined;
		throw error;
	});
	return opened;
}

function results<A>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<A> | undefined) {
	return Effect.tryPromise(() =>
		database().then(
			(db) =>
				new Promise<A | undefined>((resolve, reject) => {
					const transaction = db.transaction(RESULTS, mode);
					const request = run(transaction.objectStore(RESULTS));
					transaction.oncomplete = () => resolve(request?.result);
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				}),
		),
	);
}

// Rows are keyed [user, key]; an array sorts after every string, so [user, []] closes the range of one user's rows.
function userRows(user: string) {
	return IDBKeyRange.bound([user], [user, []]);
}

const storage: QueryStorage = {
	clear: (user) => results("readwrite", (store) => (user === undefined ? store.clear() : store.delete(userRows(user)))),
	getAll: (user) =>
		Effect.map(
			results<StoredRow[]>("readonly", (store) => store.getAll(userRows(user))),
			(rows) => (rows ?? []).map(({ key, used, value }) => ({ key, used, value })),
		),
	removeItems: (user, keys) =>
		results("readwrite", (store) => {
			for (const key of keys) {
				store.delete([user, key]);
			}
			return undefined;
		}),
	setItems: (user, entries) =>
		results("readwrite", (store) => {
			for (const entry of entries) {
				store.put({ ...entry, user });
			}
			return undefined;
		}),
};

export const browserQueryStorage = Layer.succeed(QueryStorageProvider, () => storage);
