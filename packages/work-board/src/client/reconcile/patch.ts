import { at } from "./at.ts";
import { matches } from "./matches.ts";
import { flash, normalized, record, remember, sameShell, signature, structural } from "./signature.ts";

function arrival(element: Element, highlight: boolean) {
	remember(element);
	if (highlight) {
		flash(element);
	}
	return element;
}
function replaceRange(
	current: Element,
	olds: readonly Element[],
	news: readonly Element[],
	highlight: boolean,
	left: number,
	right: number,
	kept: number,
	arrived: number,
) {
	let i = left;
	let j = right;
	for (; i < kept && j < arrived; i += 1, j += 1) {
		const old = at(olds, i);
		const next = at(news, j);
		if (sameShell(old, next)) {
			const incomingSignature = normalized(next);
			patch(old, next, highlight);
			record(old, incomingSignature);
		} else {
			old.replaceWith(arrival(next, highlight));
		}
	}
	for (; i < kept; i += 1) {
		at(olds, i).remove();
	}
	for (; j < arrived; j += 1) {
		current.insertBefore(arrival(at(news, j), highlight), olds[kept] ?? null);
	}
}
function patchChildren(current: Element, incoming: Element, highlight: boolean) {
	const olds = [...current.children];
	const news = [...incoming.children];
	let i = 0;
	let j = 0;
	for (const [kept, arrived] of matches(olds.map(signature), news.map(normalized))) {
		replaceRange(current, olds, news, highlight, i, j, kept, arrived);
		i = kept + 1;
		j = arrived + 1;
	}
}
export function patch(current: Element, incoming: Element, highlight: boolean) {
	const selected = current instanceof HTMLSelectElement ? current.value : null;
	const fallback = incoming instanceof HTMLSelectElement ? incoming.value : "";
	if (structural(current) && structural(incoming)) {
		patchChildren(current, incoming, highlight);
	} else {
		current.replaceChildren(...incoming.childNodes);
		for (const child of current.children) {
			remember(child);
		}
		if (highlight) {
			flash(current);
		}
		return;
	}
	if (current instanceof HTMLSelectElement && selected !== null) {
		current.value = [...current.options].some((option) => option.value === selected) ? selected : fallback;
	}
}
