import { useCallback, useEffect, useState } from "react";

export function useSearchDialog() {
	const [state, setState] = useState<{ readonly open: boolean; readonly returnFocus?: HTMLElement | undefined }>({ open: false });
	const open = useCallback(() => {
		const active = document.activeElement;
		setState({ open: true, returnFocus: active instanceof HTMLElement ? active : undefined });
	}, []);
	const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
	useEffect(() => {
		function key(event: KeyboardEvent) {
			if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
				event.preventDefault();
				if (state.open) {
					close();
				} else {
					open();
				}
			}
		}
		document.addEventListener("keydown", key);
		return () => document.removeEventListener("keydown", key);
	}, [state.open, open, close]);
	return { ...state, close, show: open };
}
