import { Layer } from "effect";
import { type QueryStorage, QueryStorageProvider, type StoredQuery } from "@shivaedev/contract/QueryStorage.ts";

export function memoryStorage() {
	const users = new Map<string, Map<string, StoredQuery>>();
	function bucket(user: string) {
		const existing = users.get(user) ?? new Map<string, StoredQuery>();
		users.set(user, existing);
		return existing;
	}
	const storage: QueryStorage = {
		clear: (user) => {
			if (user === undefined) {
				users.clear();
			} else {
				users.delete(user);
			}
		},
		getAll: (user) => [...(users.get(user)?.values() ?? [])],
		removeItems: (user, keys) => {
			for (const key of keys) {
				users.get(user)?.delete(key);
			}
		},
		setItems: (user, entries) => {
			for (const entry of entries) {
				bucket(user).set(entry.key, entry);
			}
		},
	};
	return { layer: Layer.succeed(QueryStorageProvider, () => storage), users };
}
