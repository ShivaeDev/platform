export function draftStorage(storageKey: string, initial: string | null = null) {
	let raw = initial;
	let denied = false;
	function check(key: string) {
		if (key !== storageKey) {
			throw new Error(`Unexpected browser storage key: ${key}`);
		}
	}
	const storage: Storage = {
		clear: () => {
			throw new Error("Unexpected browser storage clear");
		},
		getItem: (key) => {
			check(key);
			return raw;
		},
		key: () => {
			throw new Error("Unexpected browser storage enumeration");
		},
		length: 0,
		removeItem: (key) => {
			check(key);
			if (denied) {
				throw new Error("Storage access denied");
			}
			raw = null;
		},
		setItem: (key, value) => {
			check(key);
			if (denied) {
				throw new Error("Storage quota exceeded");
			}
			raw = value;
		},
	};
	return {
		denyWrites: () => {
			denied = true;
		},
		raw: () => raw,
		storage,
	};
}
