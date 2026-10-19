import { type UIEvent, useState } from "react";

export function useVirtualRows(count: number, rowHeight: number, enabled = count > 200) {
	const [scroll, setScroll] = useState({ height: 600, top: 0 });
	const start = enabled ? Math.min(Math.floor(scroll.top / rowHeight), Math.max(0, count - 1)) : 0;
	const end = enabled ? Math.min(count, start + Math.ceil(scroll.height / rowHeight) + 4) : count;
	return {
		bottom: (count - end) * rowHeight,
		end,
		onScroll: (event: UIEvent<HTMLElement>) => {
			const list = event.target instanceof HTMLElement ? event.target : event.currentTarget;
			setScroll({ height: list.clientHeight, top: list.scrollTop });
		},
		start,
		top: start * rowHeight,
	};
}
