import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppearanceControls } from "./useAppearance.ts";
import { useMedia } from "./useMedia.ts";

export function useSidebar(appearance: AppearanceControls) {
	const narrow = useMedia("(max-width: 767px)");
	const [drawer, setDrawer] = useState(false);
	const open = narrow ? drawer : !appearance.closed;
	const returnFocusRef = useRef(false);
	const close = useCallback(() => {
		returnFocusRef.current = true;
		setDrawer(false);
	}, []);
	useLayoutEffect(() => {
		if (!open && returnFocusRef.current) {
			returnFocusRef.current = false;
			document.getElementById("sidebar-toggle")?.focus({ preventScroll: true });
		}
	}, [open]);

	function toggle() {
		if (narrow) {
			setDrawer(!drawer);
		} else {
			appearance.change({ closed: !appearance.closed });
		}
	}
	useEffect(() => {
		setDrawer(false);
		if (narrow && document.getElementById("sidebar")?.contains(document.activeElement)) {
			close();
		}
	}, [narrow, close]);
	useEffect(() => {
		document.documentElement.dataset.sidebar = open ? "open" : "closed";
		if (narrow && open) {
			document.querySelector<HTMLElement>("#sidebar a")?.focus({ preventScroll: true });
		}
	}, [narrow, open]);
	useEffect(() => {
		if (!(narrow && open)) {
			return;
		}
		function key(event: KeyboardEvent) {
			if (document.querySelector("dialog[open]")) {
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
			if (event.key !== "Tab") {
				return;
			}
			trapTab(event);
		}
		document.addEventListener("keydown", key);
		document.addEventListener("board-navigate", close);
		return () => {
			document.removeEventListener("keydown", key);
			document.removeEventListener("board-navigate", close);
		};
	}, [narrow, open, close]);
	return { close, narrow, open, toggle };
}
export type SidebarControls = ReturnType<typeof useSidebar>;

function trapTab(event: KeyboardEvent) {
	const items = [...document.querySelectorAll<HTMLElement>("#sidebar a[href], #sidebar button:not(:disabled), #sidebar summary")].filter(
		(element) => element.getClientRects().length > 0,
	);
	const first = items[0];
	const last = items.at(-1);
	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last?.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first?.focus();
	}
}
