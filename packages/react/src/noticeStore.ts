import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type NoticeAction, type NoticeClock, type NoticeEntry, type NoticeKind, noticeEntry } from "#noticeEntry.ts";
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
		publish: (descriptor: Pick<NoticeDescriptor<never, TMessage>, "message" | "expiresIn">, kind: NoticeKind, action?: NoticeAction<TMessage>) => {
			if (!store.active) {
				return undefined;
			}
			const entry = noticeEntry(registry, clock, nextId, descriptor, remove, action, kind);
			nextId += 1;
			registry.set(entries, [...registry.get(entries), entry]);
			return entry.dismiss;
		},
	};
	return store;
}
export function publishNotice<R, E, TMessage = unknown>(
	store: ReturnType<typeof noticeStore<TMessage>> | undefined,
	runtime: Atom.AtomRuntime<R, E>,
	descriptor: NoticeDescriptor<R, TMessage> | undefined,
	kind: NoticeKind,
) {
	if (!(store?.active && descriptor)) {
		return undefined;
	}
	const action = descriptor.action;
	return store.publish(
		descriptor,
		kind,
		action === undefined ? undefined : { atom: runtime.fn(() => action.run).pipe(Atom.setIdleTTL(0)), label: action.label },
	);
}
