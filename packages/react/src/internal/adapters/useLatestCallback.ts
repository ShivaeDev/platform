import { useCallback, useLayoutEffect, useRef } from "react";

export function useLatestCallback<A>(callback: () => A): () => A {
	const latestRef = useRef(callback);
	useLayoutEffect(() => {
		latestRef.current = callback;
	}, [callback]);
	return useCallback(() => latestRef.current(), []);
}
