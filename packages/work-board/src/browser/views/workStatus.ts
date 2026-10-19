const closed = new Set(["closed", "done", "dropped", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]);

function normalized(status: string | undefined): string {
	return status?.trim().toLowerCase() ?? "";
}

export function closedStatus(status: string | undefined): boolean {
	return closed.has(normalized(status));
}

export function deferredStatus(status: string | undefined): boolean {
	return normalized(status) === "deferred";
}
