import { Window } from "happy-dom";
import { vi } from "vitest";

export function browserStorage() {
	const storage = new Window({ url: "http://127.0.0.1" }).localStorage;
	vi.stubGlobal("localStorage", storage);
	return storage;
}
