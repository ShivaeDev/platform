import type { DraftStorage } from "#persistence.ts";

export function draftStorage() {
	const saved = new Map<string, string>();
	const storage: DraftStorage = {
		getItem: (key) => saved.get(key) ?? null,
		removeItem: (key) => {
			saved.delete(key);
		},
		setItem: (key, value) => {
			saved.set(key, value);
		},
	};
	return { config: { key: "draft", storage: () => storage }, saved };
}
