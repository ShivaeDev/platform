import type * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import { NoticeContext } from "#client/NoticeContext.ts";
import type { NoticeDescriptor } from "#client/notices.ts";
import { publishNotice } from "#noticeStore.ts";

export function useNoticePublisher<R, E>(runtime: Atom.AtomRuntime<R, E>): (descriptor: NoticeDescriptor<R> | undefined) => void {
	const store = useContext(NoticeContext);
	return useMemo(() => (descriptor: NoticeDescriptor<R> | undefined) => publishNotice(store, runtime, descriptor), [store, runtime]);
}
