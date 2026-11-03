import { type Cause, Layer } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect, useInsertionEffect, useRef } from "react";
import { NoticeContext } from "#internal/NoticeContext.ts";
import { publishNotice } from "#internal/noticeStore.ts";
import type { NoticeDescriptor } from "#notices.ts";

const runtime = Atom.runtime(Layer.empty);

export function useQueryNotice<A, E>(
	result: AsyncResult.AsyncResult<A, E>,
	refreshing: boolean,
	notice: ((failure: { readonly cause: Cause.Cause<E>; readonly refreshing: boolean }) => NoticeDescriptor | undefined) | undefined,
) {
	const store = useContext(NoticeContext);
	const latestRef = useRef(notice);
	useInsertionEffect(() => {
		latestRef.current = notice;
	}, [notice]);
	const seenRef = useRef<AsyncResult.AsyncResult<A, E> | undefined>(undefined);
	useEffect(() => {
		if (result.waiting || seenRef.current === result) {
			return;
		}
		seenRef.current = result;
		if (store?.active && AsyncResult.isFailure(result)) {
			const descriptor = latestRef.current?.({ cause: result.cause, refreshing });
			publishNotice(store, runtime, descriptor);
		}
	}, [result, refreshing, store]);
}
