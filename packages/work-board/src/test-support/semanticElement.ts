export function semanticElement(element: Element): unknown {
	return {
		attributes: Object.fromEntries(
			[...element.attributes]
				.map((attribute) => [attribute.name, attribute.name === "style" && element instanceof HTMLElement ? element.style.cssText : attribute.value])
				.sort(([a], [b]) => (a ?? "").localeCompare(b ?? "")),
		),
		children: [...element.childNodes].map((node) => (node instanceof Element ? semanticElement(node) : node.textContent)),
		tag: element.tagName,
	};
}
