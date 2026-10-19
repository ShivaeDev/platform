import { Schema } from "effect";

const Selection = Schema.Struct({ a: Schema.Int, anchor: Schema.Array(Schema.Int), f: Schema.Int, focus: Schema.Array(Schema.Int) });
const Focus = Schema.Struct({ label: Schema.String, path: Schema.Array(Schema.Int) });
export const ReadingState = Schema.Struct({
	context: Schema.optional(Schema.Boolean),
	details: Schema.optional(Schema.Array(Schema.Boolean)),
	focus: Schema.optional(Focus),
	keyedDetails: Schema.optional(Schema.Record(Schema.String, Schema.Boolean)),
	scroll: Schema.Tuple([Schema.Finite, Schema.Finite]),
	selection: Schema.NullOr(Selection),
	sidebar: Schema.optional(Schema.Number),
});
export type ReadingState = typeof ReadingState.Type;
let releaseScroll: (() => void) | undefined;
function pathOf(node: Node, root: Node) {
	const path: number[] = [];
	for (let child: Node | null = node; child !== root; child = child.parentNode) {
		if (!child?.parentNode) {
			return undefined;
		}
		const nodes: readonly Node[] = [...child.parentNode.childNodes];
		path.unshift(nodes.indexOf(child));
	}
	return path;
}
function nodeAt(path: readonly number[], root: Node): Node | undefined {
	return path.reduce<Node | undefined>((node, index) => node?.childNodes[index], root);
}
function details(root: Element) {
	const counts = new Map<string, number>();
	return [...root.querySelectorAll<HTMLDetailsElement>("details:not(.item-context)")].map((detail) => {
		const name = detail.dataset.key || detail.querySelector("summary")?.textContent || "details";
		const occurrence = counts.get(name) ?? 0;
		counts.set(name, occurrence + 1);
		return [`${name}:${occurrence}`, detail] as const;
	});
}
function focusLabel(element: Element) {
	return element.getAttribute("href") ?? `${element.tagName}:${element.textContent?.trim().slice(0, 80)}`;
}
function focused() {
	const active = document.activeElement;
	const path = active && active !== document.body ? pathOf(active, document.body) : undefined;
	return active && path ? { label: focusLabel(active), path } : undefined;
}
// A control that moved is still found by its link or text, as long as only one matches.
function focusTarget({ label, path }: typeof Focus.Type) {
	const atPath = nodeAt(path, document.body);
	if (atPath instanceof HTMLElement && focusLabel(atPath) === label) {
		return atPath;
	}
	const matches = [...document.body.querySelectorAll<HTMLElement>("a[href], button")].filter((element) => focusLabel(element) === label);
	return matches.length === 1 ? matches[0] : undefined;
}
export function restoreFocus(state: ReadingState) {
	if (state.focus) {
		focusTarget(state.focus)?.focus({ preventScroll: true });
	}
}
function inForm() {
	return document.activeElement?.closest("[data-response-form], #response-form, #handoff-form");
}
export function captureReading(): ReadingState | undefined {
	const root = document.getElementById("doc");
	if (!root) {
		return undefined;
	}
	const selection = inForm() ? null : document.getSelection();
	const anchor = selection?.anchorNode && pathOf(selection.anchorNode, root);
	const focus = selection?.focusNode && pathOf(selection.focusNode, root);
	return {
		context: root.querySelector<HTMLDetailsElement>(".item-context")?.open,
		details: details(root).map(([, detail]) => detail.open),
		focus: focused(),
		keyedDetails: Object.fromEntries(details(root).map(([key, detail]) => [key, detail.open])),
		scroll: [scrollX, scrollY],
		selection: anchor && focus && selection ? { a: selection.anchorOffset, anchor, f: selection.focusOffset, focus } : null,
		sidebar: document.getElementById("sidebar")?.scrollTop ?? 0,
	};
}
export function restoreReading(state: ReadingState) {
	const root = document.getElementById("doc");
	if (!root) {
		return;
	}
	const context = root.querySelector<HTMLDetailsElement>(".item-context");
	if (context && state.context !== undefined) {
		context.open = state.context;
	}
	details(root).forEach(([key, detail], index) => {
		const open = state.keyedDetails ? state.keyedDetails[key] : state.details?.[index];
		if (open !== undefined) {
			detail.open = open;
		}
	});
	const sidebar = document.getElementById("sidebar");
	if (sidebar) {
		sidebar.scrollTop = state.sidebar ?? 0;
	}
	if (state.selection && !inForm()) {
		const { anchor: anchorPath, focus: focusPath, a, f } = state.selection;
		const anchor = nodeAt(anchorPath, root);
		const focus = nodeAt(focusPath, root);
		function limit(node: Node) {
			return node.nodeType === 3 ? (node.textContent?.length ?? 0) : node.childNodes.length;
		}
		if (anchor && focus) {
			document.getSelection()?.setBaseAndExtent(anchor, Math.max(0, Math.min(a, limit(anchor))), focus, Math.max(0, Math.min(f, limit(focus))));
		}
	}
	restoreScroll(state.scroll);
}
function restoreScroll(scroll: readonly [number, number]) {
	releaseScroll?.();
	const root = document.documentElement;
	const anchoring = root.style.overflowAnchor;
	// Keep the saved offset while the restored passage status changes layout in this frame.
	root.style.overflowAnchor = "none";
	window.scrollTo(...scroll);
	let frame = requestAnimationFrame(() => {
		frame = requestAnimationFrame(() => releaseScroll?.());
	});
	releaseScroll = () => {
		cancelAnimationFrame(frame);
		root.style.overflowAnchor = anchoring;
		releaseScroll = undefined;
	};
}
