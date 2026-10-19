import type { InboxProjection } from "#browser/views/schema.ts";

export function todayKey(item: InboxProjection["you"][number]) {
	return `${item.file}:${item.href}`;
}
