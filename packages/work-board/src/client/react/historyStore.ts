const stores = new WeakMap<Document, Map<string, ReturnType<typeof createStore>>>();
export function historyStore() {
	const key = `work-board:changes:${document.documentElement.dataset.workspace}`;
	let workspace = stores.get(document);
	if (!workspace) {
		workspace = new Map();
		stores.set(document, workspace);
	}
	let store = workspace.get(key);
	if (!store) {
		store = createStore(key);
		workspace.set(key, store);
	}
	return store;
}
function createStore(key: string) {
	let memory: string | null | undefined;
	let notice = "";
	function read() {
		if (memory !== undefined) {
			return memory;
		}
		try {
			return window.localStorage.getItem(key);
		} catch {
			memory = null;
			notice = "Browser storage unavailable; history applies to this page only.";
			return memory;
		}
	}
	function write(raw: string | null) {
		memory = raw;
		try {
			if (raw === null) {
				window.localStorage.removeItem(key);
			} else {
				window.localStorage.setItem(key, raw);
			}
			memory = undefined;
			notice = "";
		} catch {
			notice =
				raw === null
					? "Cleared for this page, but browser storage could not be cleared. Reload may restore older data."
					: "Snapshot remembered for this page only; browser storage is unavailable.";
			if (raw !== null) {
				try {
					window.localStorage.removeItem(key);
				} catch {
					notice += " Reload may restore older data.";
				}
			}
		}
	}
	return { key, notice: () => notice, read, write };
}
