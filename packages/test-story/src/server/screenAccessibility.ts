import { computeAccessibleName, getRole } from "dom-accessibility-api";

export function accessibility(element: Element) {
	return { name: computeAccessibleName(element), role: getRole(element) };
}

export function isRendered(found: HTMLElement) {
	const visibility = getComputedStyle(found).visibility;
	if (visibility === "hidden" || visibility === "collapse") {
		return false;
	}
	for (let ancestor: HTMLElement | null = found; ancestor; ancestor = ancestor.parentElement) {
		const style = getComputedStyle(ancestor);
		if (ancestor.hidden || style.display === "none" || style.contentVisibility === "hidden") {
			return false;
		}
	}
	return true;
}
