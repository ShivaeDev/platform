import { patch } from "./patch.ts";

function keysOf(root: Element): readonly (readonly [string, HTMLDetailsElement])[] {
	const seen = new Map<string, number>();
	return [...root.querySelectorAll("details")].map((details) => {
		const base =
			details.dataset.key
			?? `${details.closest(".item")?.querySelector("h3")?.textContent ?? ""}|${details.querySelector("summary")?.textContent ?? ""}`;
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return [`${base}#${count}`, details];
	});
}
export function swap(current: Element, incoming: Element, highlight = false) {
	const before = keysOf(current);
	const open = new Map(before.map(([key, details]) => [key, details.open]));
	const existing = new Set(before.map(([, details]) => details));
	const drawings = [...current.querySelectorAll("figure.diagram")].map((figure) => figure.querySelector(".diagram-svg"));
	patch(current, incoming, highlight);
	const figures = [...current.querySelectorAll<HTMLElement>("figure.diagram")];
	if (drawings.length === figures.length) {
		figures.forEach((figure, index) => {
			const drawing = drawings[index];
			if (figure.dataset.state !== "pending" || !drawing || drawing.isConnected) {
				return;
			}
			figure.prepend(drawing);
			figure.dataset.state = "redrawing";
		});
	}
	for (const [key, details] of keysOf(current)) {
		const was = open.get(key);
		if (was !== undefined && !existing.has(details)) {
			details.open = was;
		}
	}
}
