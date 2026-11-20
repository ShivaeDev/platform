import type { StoredQuery } from "#QueryStorage.ts";

const DATABASE = "@shivaedev/contract/queries";
const RESULTS = "results";

interface StoredRow extends StoredQuery {
	readonly user: string;
}

interface IndexedHost {
	readonly factory: IDBFactory;
	readonly keyRange: typeof IDBKeyRange;
}

export function indexedQueryRows(host: () => IndexedHost) {
	let opened: Promise<IDBDatabase> | undefined;
	function database(): Promise<IDBDatabase> {
		opened ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = host().factory.open(DATABASE, 1);
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
	async function results<A>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<A> | undefined) {
		const db = await database();
		return new Promise<A | undefined>((resolve, reject) => {
			const transaction = db.transaction(RESULTS, mode);
			const request = run(transaction.objectStore(RESULTS));
			transaction.oncomplete = () => resolve(request?.result);
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	}
	// Rows are keyed [user, key]; an array sorts after every string, so [user, []] closes the range of one user's rows.
	function userRows(user: string) {
		return host().keyRange.bound([user], [user, []]);
	}
	return {
		clear: (user?: string) => results("readwrite", (store) => (user === undefined ? store.clear() : store.delete(userRows(user)))),
		getAll: async (user: string): Promise<StoredQuery[]> => {
			const rows = await results<StoredRow[]>("readonly", (store) => store.getAll(userRows(user)));
			return (rows ?? []).map(({ key, used, value }) => ({ key, used, value }));
		},
		removeItems: (user: string, keys: readonly string[]) =>
			results("readwrite", (store) => {
				for (const key of keys) {
					store.delete([user, key]);
				}
				return undefined;
			}),
		setItems: (user: string, entries: readonly StoredQuery[]) =>
			results("readwrite", (store) => {
				for (const entry of entries) {
					store.put({ ...entry, user });
				}
				return undefined;
			}),
	};
}
