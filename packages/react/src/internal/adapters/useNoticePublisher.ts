import type * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import { NoticeContext } from "#internal/NoticeContext.ts";
import { publishNotice } from "#internal/noticeStore.ts";
import type { NoticeDescriptor } from "#notices.ts";

export function useNoticePublisher<R, E>(runtime: Atom.AtomRuntime<R, E>): (descriptor: NoticeDescriptor<R> | undefined) => void {
	const store = useContext(NoticeContext);
	return useMemo(() => (descriptor: NoticeDescriptor<R> | undefined) => publishNotice(store, runtime, descriptor), [store, runtime]);
}
