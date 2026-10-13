export function searchStatus(
	text: string,
	pending: boolean,
	failed: boolean,
	data:
		| {
				readonly total: number;
				readonly results: readonly unknown[];
				readonly unavailable: readonly string[];
		  }
		| undefined,
) {
	if (!text) {
		return "Type to search this workspace, or choose a command.";
	}
	if (failed) {
		return "Search could not be completed. Press Search to retry.";
	}
	if (pending || !data) {
		return "Searching…";
	}
	let message = "No document matches.";
	if (data.total) {
		message = `${data.total > data.results.length ? `Showing ${data.results.length} of ` : ""}${data.total} matches.`;
	}
	if (data.unavailable.length > 0) {
		message += ` Could not read ${data.unavailable.length} files; results are incomplete.`;
	}
	return message;
}
