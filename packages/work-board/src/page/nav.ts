import { navigationHtml } from "#browser/navigation/html.ts";
import type { MarkdownFile } from "#files/list.ts";
import { inboxCount as countOf, navigationData } from "#navigation/model.ts";
import type { Snapshot } from "#search/snapshot.ts";

export function navHtml(files: readonly MarkdownFile[], current: string, home: string | undefined, snapshot?: Snapshot): string {
	return navigationHtml(navigationData(files, current, home, snapshot));
}

export function inboxCount(snapshot?: Snapshot): string {
	return String(countOf(snapshot) ?? "?");
}
