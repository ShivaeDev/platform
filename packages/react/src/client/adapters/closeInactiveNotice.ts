import type { noticeStore } from "#noticeStore.ts";

export function closeInactiveNotice<TMessage>(store: ReturnType<typeof noticeStore<TMessage>>): void {
	store.active = false;
	queueMicrotask(() => {
		if (!store.active) {
			store.close();
		}
	});
}
