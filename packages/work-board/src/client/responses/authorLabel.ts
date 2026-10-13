export function authorLabel(storage: () => Storage, workspace: string | undefined) {
	const key = `work-board:author:${workspace ?? ""}`;
	function read(draft: string) {
		if (draft) {
			return draft;
		}
		try {
			return storage().getItem(key)?.slice(0, 200) ?? "";
		} catch {
			return "";
		}
	}
	function save(value: string) {
		try {
			storage().setItem(key, value.slice(0, 200));
			return true;
		} catch {
			return false;
		}
	}
	return { read, save };
}
