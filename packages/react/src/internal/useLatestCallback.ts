import { useCallback, useLayoutEffect, useRef } from "react";

export function useLatestCallback(callback: () => void): () => void {
	const latestRef = useRef(callback);
	useLayoutEffect(() => {
		latestRef.current = callback;
	}, [callback]);
	return useCallback(() => latestRef.current(), []);
}
