import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type NoticeAction, type NoticeClock, type NoticeEntry, noticeEntry } from "#noticeEntry.ts";
import type { NoticeDescriptor } from "#noticeTypes.ts";

export function noticeStore<TMessage = unknown>(registry: AtomRegistry.AtomRegistry, clock: NoticeClock) {
	const entries = Atom.make<readonly NoticeEntry<TMessage>[]>([]);
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
		publish: (descriptor: Pick<NoticeDescriptor<never, TMessage>, "message" | "expiresIn">, action?: NoticeAction<TMessage>) => {
			if (!store.active) {
				return;
			}
			const entry = noticeEntry(registry, clock, nextId, descriptor, remove, action);
			nextId += 1;
			registry.set(entries, [...registry.get(entries), entry]);
		},
	};
	return store;
}
export function publishNotice<R, E, TMessage = unknown>(
	store: ReturnType<typeof noticeStore<TMessage>> | undefined,
	runtime: Atom.AtomRuntime<R, E>,
	descriptor: NoticeDescriptor<R, TMessage> | undefined,
) {
	if (!(store?.active && descriptor)) {
		return;
	}
	const action = descriptor.action;
	store.publish(descriptor, action === undefined ? undefined : { atom: runtime.fn(() => action.run).pipe(Atom.setIdleTTL(0)), label: action.label });
}
