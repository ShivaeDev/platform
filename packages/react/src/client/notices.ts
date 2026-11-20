import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Layer } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { createElement, Fragment, type ReactNode, useContext, useInsertionEffect, useLayoutEffect, useMemo, useRef } from "react";
import { closeInactiveNotice } from "#client/adapters/closeInactiveNotice.ts";
import { FailureHostContext } from "#client/FailureHostContext.ts";
import { NoticeContext } from "#client/NoticeContext.ts";
import type { UnexpectedFailure } from "#client/unexpectedFailure.ts";
import type { NoticeClock, NoticeEntry, NoticeKind } from "#noticeEntry.ts";
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
	readonly kind: NoticeKind;
	readonly message: ReactNode;
}
export interface NoticeFeedback<TInput, A, R = never> extends SharedNoticeFeedback<TInput, A, R, ReactNode> {}
export type FailureNotice = Omit<NoticeDescriptor, "action">;
function Entry({ entry, render }: { readonly entry: NoticeEntry<ReactNode>; readonly render: (notice: Notice) => ReactNode }) {
	const result = useAtomValue(entry.status);
	return render({
		action: entry.action === undefined ? undefined : { ...entry.action, pending: result.waiting, result },
		dismiss: entry.dismiss,
		id: entry.id,
		kind: entry.kind,
		message: entry.message,
	});
}
function Entries({ store, render }: { readonly store: ReturnType<typeof noticeStore<ReactNode>>; readonly render: (notice: Notice) => ReactNode }) {
	const entries = useAtomValue(store.entries);
	return entries.map((entry) => createElement(Entry, { entry, key: entry.id, render }));
}
const defaultClock = Atom.runtime(Layer.empty);
export function renderNotice(notice: Notice): ReactNode {
	const action = notice.action;
	return createElement(
		"div",
		{ "data-notice": notice.kind, role: notice.kind === "success" ? "status" : "alert" },
		createElement("p", null, notice.message),
		action && createElement("button", { disabled: action.pending, onClick: action.run, type: "button" }, action.label),
		createElement("button", { onClick: notice.dismiss, type: "button" }, "Dismiss"),
	);
}
function failureNotice(failure: UnexpectedFailure): FailureNotice {
	return { message: failure.message };
}
export function NoticeHost({
	children,
	failure = failureNotice,
	render = renderNotice,
	runtime = defaultClock,
}: {
	readonly children: ReactNode;
	// The one place an application words the failures no screen handles: transport, server outages and defects.
	readonly failure?: ((failure: UnexpectedFailure) => FailureNotice | "silent") | undefined;
	readonly render?: ((notice: Notice) => ReactNode) | undefined;
	readonly runtime?: NoticeClock | undefined;
}): ReactNode {
	const registry = useContext(RegistryContext);
	const store = useMemo(() => noticeStore<ReactNode>(registry, runtime), [registry, runtime]);
	const wordingRef = useRef(failure);
	useInsertionEffect(() => {
		wordingRef.current = failure;
	}, [failure]);
	const report = useMemo(
		() => (unexpected: UnexpectedFailure) => {
			const descriptor = wordingRef.current(unexpected);
			if (descriptor !== "silent") {
				store.publish(descriptor, "failure");
			}
		},
		[store],
	);
	useLayoutEffect(() => {
		store.active = true;
		return () => closeInactiveNotice(store);
	}, [store]);
	return createElement(
		NoticeContext.Provider,
		{ value: store },
		createElement(FailureHostContext.Provider, { value: report }, createElement(Fragment, null, children, createElement(Entries, { render, store }))),
	);
}
