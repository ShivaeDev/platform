import type { Navigation } from "#browser/Navigation.ts";

export function shownInboxCount(data: Navigation | undefined, settled: boolean): number | null | undefined {
	if (data) {
		return data.inboxCount;
	}
	return settled ? null : undefined;
}
