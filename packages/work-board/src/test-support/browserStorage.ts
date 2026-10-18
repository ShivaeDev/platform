import { vi } from "vitest";

export function browserStorage() {
	const storage = window.localStorage;
	storage.clear();
	vi.stubGlobal("localStorage", storage);
	return storage;
}
