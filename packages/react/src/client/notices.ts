import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Layer } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { createElement, Fragment, type ReactNode, useContext, useLayoutEffect, useMemo } from "react";
import { closeInactiveNotice } from "#client/adapters/closeInactiveNotice.ts";
import { NoticeContext } from "#client/NoticeContext.ts";
import type { NoticeClock, NoticeEntry } from "#noticeEntry.ts";
import { noticeStore } from "#noticeStore.ts";
import type { NoticeDescriptor as SharedNoticeDescriptor, NoticeFeedback as SharedNoticeFeedback } from "#noticeTypes.ts";

export interface NoticeDescriptor<R = never> extends SharedNoticeDescriptor<R, ReactNode> {}
export interface Notice {
	readonly action?:
		| {
				readonly label: ReactNode;
				readonly pending: boolean;
				readonly result: AsyncResult.AsyncResult<unknown, unknown>;
				readonly run: () => void;
		  }
		| undefined;
	readonly dismiss: () => void;
	readonly id: number;
	readonly message: ReactNode;
}
export interface NoticeFeedback<TInput, A, E, R = never> extends SharedNoticeFeedback<TInput, A, E, R, ReactNode> {}
function Entry({ entry, render }: { readonly entry: NoticeEntry<ReactNode>; readonly render: (notice: Notice) => ReactNode }) {
	const result = useAtomValue(entry.status);
	return render({
		action: entry.action === undefined ? undefined : { ...entry.action, pending: result.waiting, result },
		dismiss: entry.dismiss,
		id: entry.id,
		message: entry.message,
	});
}
function Entries({ store, render }: { readonly store: ReturnType<typeof noticeStore<ReactNode>>; readonly render: (notice: Notice) => ReactNode }) {
	const entries = useAtomValue(store.entries);
	return entries.map((entry) => createElement(Entry, { entry, key: entry.id, render }));
}
const defaultClock = Atom.runtime(Layer.empty);
export function NoticeHost({
	children,
	render,
	runtime = defaultClock,
}: {
	readonly children: ReactNode;
	readonly render: (notice: Notice) => ReactNode;
	readonly runtime?: NoticeClock | undefined;
}): ReactNode {
	const registry = useContext(RegistryContext);
	const store = useMemo(() => noticeStore<ReactNode>(registry, runtime), [registry, runtime]);
	useLayoutEffect(() => {
		store.active = true;
		return () => closeInactiveNotice(store);
	}, [store]);
	return createElement(NoticeContext.Provider, { value: store }, createElement(Fragment, null, children, createElement(Entries, { render, store })));
}
