const implicitRoles: Readonly<Record<string, string>> = { ASIDE: "complementary", BUTTON: "button", NAV: "navigation" };
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
export function accessibleName(element: Element) {
	return element.getAttribute("aria-label") ?? element.textContent.trim();
}
