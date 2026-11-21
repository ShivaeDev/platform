import type { SecondaryStorage } from "better-auth";

// Some hosted Redis clients parse stored JSON before returning it.
function parsedValue(value: string | undefined): unknown {
	try {
		return value === undefined ? null : JSON.parse(value);
	} catch {
		return value;
	}
}

// Better Auth keeps sessions only here when secondary storage is configured, so the map stands in for a shared cache such as Redis.
export function memorySecondaryStorage(parses: boolean): SecondaryStorage {
	const entries = new Map<string, string>();
	return {
		delete: (key) => {
			entries.delete(key);
		},
		get: (key) => (parses ? parsedValue(entries.get(key)) : (entries.get(key) ?? null)),
		getAndDelete: (key) => {
			const value = entries.get(key) ?? null;
			entries.delete(key);
			return value;
		},
		increment: (key) => {
			const count = Number(entries.get(key) ?? 0) + 1;
			entries.set(key, String(count));
			return count;
		},
		set: (key, value) => {
			entries.set(key, value);
		},
	};
}
