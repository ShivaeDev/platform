import type { DraftStorage } from "#persistence.ts";

export function draftStorage(now: () => number) {
	const saved = new Map<string, string>();
	const storage: DraftStorage = {
		getItem: (key) => saved.get(key) ?? null,
		removeItem: (key, expected) => {
			if (saved.get(key) === expected) {
				saved.delete(key);
			}
		},
		setItem: (key, value, expected) => {
			if (expected === undefined || saved.get(key) === expected) {
				saved.set(key, value);
			}
		},
	};
	return { config: { key: "draft", now, storage: () => storage }, saved };
}
