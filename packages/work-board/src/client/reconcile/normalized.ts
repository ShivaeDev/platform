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
