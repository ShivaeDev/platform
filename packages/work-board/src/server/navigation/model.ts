import type { Navigation } from "#browser/Navigation.ts";
import { openItem } from "#server/attention/inbox.ts";
import { attentionProjection } from "#server/attention/projection.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { goals } from "#server/views/goals.ts";

export function inboxCount(snapshot?: Snapshot): number | null {
	return snapshot && snapshot.unavailable.length === 0 ? attentionProjection(snapshot).you.length : null;
}
export function navigationData(files: readonly MarkdownFile[], _current: string, home: string | undefined, snapshot?: Snapshot): Navigation {
	const id = snapshot?.documents.find((document) => document.file === home)?.parsed.fields.id;
	const unique = id !== undefined && snapshot?.unavailable.length === 0 && snapshot.model.ids.get(id)?.length === 1;
	return {
		...(home === undefined ? {} : { home: { file: home, ...(unique ? { identity: id } : {}) } }),
		counts: {
			goals: snapshot ? goals(snapshot).goals.length : 0,
			library: files.length,
			now: snapshot?.documents.filter((document) => document.parsed.fields.kind === "task" && openItem(document)).length ?? 0,
			system: snapshot ? [...snapshot.model.diagnostics.values()].flat().length + snapshot.unavailable.length : 0,
		},
		inboxCount: inboxCount(snapshot),
	};
}
