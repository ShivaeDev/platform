import { type UIEvent, useEffect, useRef, useState } from "react";

interface Scroll {
	readonly height: number;
	readonly top: number;
}

function moved(current: Scroll, next: Scroll, rowHeight: number) {
	return Math.floor(current.top / rowHeight) === Math.floor(next.top / rowHeight) && current.height === next.height ? current : next;
}

// A list without its own scroller moves with the page, so its window follows the list's place in the viewport.
export function useVirtualRows<TElement extends HTMLElement>(count: number, rowHeight: number, enabled = count > 200, bounded = false) {
	const [scroll, setScroll] = useState<Scroll>({ height: 600, top: 0 });
	const ref = useRef<TElement>(null);
	useEffect(() => {
		if (!enabled || bounded) {
			return;
		}
		function measure() {
			const list = ref.current;
			if (list) {
				const next = { height: window.innerHeight, top: Math.max(0, -list.getBoundingClientRect().top) };
				setScroll((current) => moved(current, next, rowHeight));
			}
		}
		measure();
		window.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			window.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, [enabled, bounded, rowHeight]);
	const start = enabled ? Math.min(Math.floor(scroll.top / rowHeight), Math.max(0, count - 1)) : 0;
	const end = enabled ? Math.min(count, start + Math.ceil(scroll.height / rowHeight) + 4) : count;
	return {
		bottom: (count - end) * rowHeight,
		end,
		onScroll: (event: UIEvent<HTMLElement>) => {
			const list = event.target instanceof HTMLElement ? event.target : event.currentTarget;
			const next = { height: list.clientHeight, top: list.scrollTop };
			setScroll((current) => moved(current, next, rowHeight));
		},
		ref,
		start,
		top: start * rowHeight,
	};
}
