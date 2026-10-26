import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { Duration, Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import { createElement, Fragment, type ReactNode, useContext, useLayoutEffect, useMemo } from "react";
import type { AtomServices } from "#fieldRejection.ts";
import { NoticeContext } from "#internal/NoticeContext.ts";
import type { NoticeEntry } from "#internal/noticeEntry.ts";
import { noticeStore } from "#internal/noticeStore.ts";

export interface NoticeDescriptor<R = never> {
	readonly action?:
		| {
				readonly label: ReactNode;
				readonly run: Effect.Effect<unknown, unknown, AtomServices<R>>;
		  }
		| undefined;
	readonly expiresIn?: Duration.Input | undefined;
	readonly message: ReactNode;
}
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
export interface NoticeFeedback<TInput, A, E, R = never> {
	readonly onFailure?: (error: E, input: TInput) => NoticeDescriptor<R> | undefined;
	readonly onSuccess?: (value: A, input: TInput) => NoticeDescriptor<R> | undefined;
}
function Entry({ entry, render }: { readonly entry: NoticeEntry; readonly render: (notice: Notice) => ReactNode }) {
	const result = useAtomValue(entry.status);
	return render({
		action: entry.action === undefined ? undefined : { ...entry.action, pending: result.waiting, result },
		dismiss: entry.dismiss,
		id: entry.id,
		message: entry.message,
	});
}
function Entries({ store, render }: { readonly store: ReturnType<typeof noticeStore>; readonly render: (notice: Notice) => ReactNode }) {
	const entries = useAtomValue(store.entries);
	return entries.map((entry) => createElement(Entry, { entry, key: entry.id, render }));
}
export function NoticeHost({ children, render }: { readonly children: ReactNode; readonly render: (notice: Notice) => ReactNode }): ReactNode {
	const registry = useContext(RegistryContext);
	const store = useMemo(() => noticeStore(registry), [registry]);
	useLayoutEffect(() => {
		store.active = true;
		return () => {
			store.active = false;
			queueMicrotask(() => {
				if (!store.active) {
					store.close();
				}
			});
		};
	}, [store]);
	return createElement(NoticeContext.Provider, { value: store }, createElement(Fragment, null, children, createElement(Entries, { render, store })));
}
