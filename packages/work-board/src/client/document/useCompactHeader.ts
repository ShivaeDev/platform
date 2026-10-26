import { useEffect, useRef, useState } from "react";

function stuck(header: HTMLElement) {
	const top = Number.parseFloat(getComputedStyle(header).top) || 0;
	const layout = header.parentElement?.getBoundingClientRect().top ?? 0;
	return layout < top && header.getBoundingClientRect().top >= top - 1;
}

export function useCompactHeader(sticky: boolean) {
	const ref = useRef<HTMLElement>(null);
	const compactRef = useRef(false);
	const [compact, setCompact] = useState(false);
	const [height, setHeight] = useState(0);
	useEffect(() => {
		const header = ref.current;
		function update() {
			const next = Boolean(sticky && header && stuck(header));
			if (next === compactRef.current) {
				return;
			}
			if (next && header) {
				setHeight(header.offsetHeight);
			}
			compactRef.current = next;
			setCompact(next);
		}
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, [sticky]);
	return { compact, height, ref };
}
