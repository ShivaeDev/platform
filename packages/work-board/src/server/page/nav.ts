import { navigationHtml } from "#browser/navigation/html.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { inboxCount as countOf, navigationData } from "#server/navigation/model.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function navHtml(files: readonly MarkdownFile[], current: string, home: string | undefined, snapshot?: Snapshot): string {
	return navigationHtml(navigationData(files, current, home, snapshot));
}

export function inboxCount(snapshot?: Snapshot): string {
	return String(countOf(snapshot) ?? "?");
}
