const implicitRoles: Readonly<Record<string, string>> = {
	ASIDE: "complementary",
	BUTTON: "button",
	LI: "listitem",
	NAV: "navigation",
	OL: "list",
	UL: "list",
};
export function accessibleRole(element: Element) {
	if (element.hasAttribute("role")) {
		return element.getAttribute("role");
	}
	if (element.tagName === "A") {
		return element.hasAttribute("href") ? "link" : null;
	}
	if (element.tagName === "SECTION") {
		return element.hasAttribute("aria-label") ? "region" : null;
	}
	return implicitRoles[element.tagName] ?? null;
}
interface Labelled {
	getAttribute(name: string): string | null;
	readonly textContent: string | null;
	readonly ownerDocument: { getElementById(id: string): { readonly textContent: string | null } | null };
}
export function accessibleName(element: Labelled) {
	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		return labelledBy
			.split(/\s+/u)
			.map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
			.join(" ");
	}
	return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
}
