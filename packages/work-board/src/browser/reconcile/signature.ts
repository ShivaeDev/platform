const containers = new Set(["DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "NAV", "FORM", "SELECT", "LABEL", "ASIDE", "DETAILS"]);
const pristine = new WeakMap<Element, string>();
export function structural(element: Element) {
	return [...element.childNodes].every((node) => node.nodeType === 1 || node.textContent?.trim() === "");
}
export function flash(element: Element) {
	if (element.matches("[data-modified]") || !element.matches("p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, .item, .notes, .metadata-panel")) {
		return;
	}
	element.setAttribute("data-live-change", "");
	setTimeout(() => element.removeAttribute("data-live-change"), 2500);
}
export function normalized(element: Element) {
	const copy = element.cloneNode(true);
	if (!(copy instanceof Element)) {
		throw new Error("Expected an element");
	}
	for (const form of [copy, ...copy.querySelectorAll("#response-form, #handoff-form")]) {
		if (form.id === "response-form" || form.id === "handoff-form") {
			form.replaceChildren();
			form.removeAttribute("data-bound");
		}
	}
	for (const tool of copy.querySelectorAll("[data-visual-tools], [data-image-error], [data-diagram-error]")) {
		tool.remove();
	}
	for (const node of [copy, ...copy.querySelectorAll("*")]) {
		normalizeNode(node);
	}
	return copy.outerHTML;
}
export function remember(element: Element) {
	pristine.set(element, normalized(element));
	if (containers.has(element.tagName)) {
		for (const child of element.children) {
			remember(child);
		}
	}
}
export function signature(element: Element) {
	if (!pristine.has(element)) {
		pristine.set(element, normalized(element));
	}
	return pristine.get(element);
}
export function record(element: Element, value: string) {
	pristine.set(element, value);
}
function normalizedShell(element: Element) {
	const copy = element.cloneNode(false);
	if (!(copy instanceof Element)) {
		throw new Error("Expected an element");
	}
	copy.removeAttribute("data-live-change");
	if (copy.tagName === "DETAILS") {
		copy.removeAttribute("open");
	}
	return copy.outerHTML;
}
export function sameShell(old: Element, next: Element) {
	return old.tagName === next.tagName && containers.has(old.tagName) && normalizedShell(old) === normalizedShell(next);
}

function normalizeNode(node: Element) {
	node.removeAttribute("data-live-change");
	if (node.tagName === "DETAILS") {
		node.removeAttribute("open");
	}
	if (node.matches("figure.diagram")) {
		node.querySelector(".diagram-svg")?.remove();
		node.setAttribute("data-state", "pending");
		node.removeAttribute("data-error");
	}
	if (node.matches("[data-modified]")) {
		node.textContent = "";
	}
	if (node.matches("img[data-local-image]")) {
		node.setAttribute("src", node.getAttribute("data-local-image") ?? "");
		for (const attribute of ["tabindex", "role", "aria-label"]) {
			node.removeAttribute(attribute);
		}
	}
}
