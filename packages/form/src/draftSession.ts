export interface DraftSession {
	readonly active: boolean;
	readonly drop: () => void;
	readonly id: string;
	readonly track: (key: string, clear: () => void) => void;
}

export function draftSession(id: string): DraftSession {
	const drafts = new Map<string, () => void>();
	let active = true;
	return {
		get active() {
			return active;
		},
		drop: () => {
			active = false;
			for (const clear of drafts.values()) {
				clear();
			}
			drafts.clear();
		},
		id,
		track: (key, clear) => {
			if (active) {
				drafts.set(key, clear);
			}
		},
	};
}
