import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { NoticeDescriptor } from "#notices.ts";
import { type NoticeAction, type NoticeEntry, noticeEntry } from "./noticeEntry.ts";

export function noticeStore(registry: AtomRegistry.AtomRegistry) {
	const entries = Atom.make<readonly NoticeEntry[]>([]);
	let nextId = 0;
	function remove(id: number) {
		registry.set(
			entries,
			registry.get(entries).filter((entry) => entry.id !== id),
		);
	}
	const store = {
		active: false,
		close: () => {
			store.active = false;
			for (const entry of registry.get(entries)) {
				entry.release();
			}
			registry.set(entries, []);
		},
		entries,
		publish: (descriptor: Pick<NoticeDescriptor, "message" | "expiresIn">, action?: NoticeAction) => {
			if (!store.active) {
				return;
			}
			const entry = noticeEntry(registry, nextId, descriptor, remove, action);
			nextId += 1;
			registry.set(entries, [...registry.get(entries), entry]);
		},
	};
	return store;
}
export function publishNotice<R, E>(
	store: ReturnType<typeof noticeStore> | undefined,
	runtime: Atom.AtomRuntime<R, E>,
	descriptor: NoticeDescriptor<R> | undefined,
) {
	if (!(store?.active && descriptor)) {
		return;
	}
	const action = descriptor.action;
	store.publish(descriptor, action === undefined ? undefined : { atom: runtime.fn(() => action.run).pipe(Atom.setIdleTTL(0)), label: action.label });
}
