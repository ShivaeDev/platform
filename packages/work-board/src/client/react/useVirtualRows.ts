import { type UIEvent, useEffect, useRef, useState } from "react";

// A list without its own scroller moves with the page, so its window follows the list's place in the viewport.
export function useVirtualRows<TElement extends HTMLElement>(count: number, rowHeight: number, enabled = count > 200, bounded = false) {
	// The first row and the height are kept apart so React skips the render while a scroll stays inside one row.
	const [first, setFirst] = useState(0);
	const [height, setHeight] = useState(600);
	const ref = useRef<TElement>(null);
	useEffect(() => {
		const list = ref.current;
		if (!enabled || bounded || !list) {
			return;
		}
		const element: HTMLElement = list;
		function measure() {
			setHeight(window.innerHeight);
			setFirst(Math.floor(Math.max(0, -element.getBoundingClientRect().top) / rowHeight));
		}
		measure();
		window.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			window.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, [enabled, bounded, rowHeight]);
	const start = enabled ? Math.min(first, Math.max(0, count - 1)) : 0;
	const end = enabled ? Math.min(count, start + Math.ceil(height / rowHeight) + 4) : count;
	return {
		bottom: (count - end) * rowHeight,
		end,
		onScroll: (event: UIEvent<HTMLElement>) => {
			setHeight(event.currentTarget.clientHeight);
			setFirst(Math.floor(event.currentTarget.scrollTop / rowHeight));
		},
		ref,
		start,
		top: start * rowHeight,
	};
}
