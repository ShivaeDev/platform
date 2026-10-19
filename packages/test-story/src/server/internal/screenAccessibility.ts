import { computeAccessibleName, getRole, isInaccessible } from "dom-accessibility-api";
import type { ScreenTarget } from "#screenDriver.ts";

export function accessibility(element: Element) {
	return { name: computeAccessibleName(element), role: getRole(element) };
}

export function targetName(target: ScreenTarget): string {
	return typeof target === "string"
		? target
		: `${target.role} named ${typeof target.name === "string" ? JSON.stringify(target.name) : String(target.name)}`;
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

export function roleElement(root: HTMLElement, target: Exclude<ScreenTarget, string>) {
	const candidates = Array.from(root.querySelectorAll<HTMLElement>("*"))
		.filter((element) => isRendered(element) && !isInaccessible(element))
		.map((element) => ({ ...accessibility(element), element }))
		.filter(({ role }) => role !== null);
	const matches = candidates.filter(({ role, name }) => {
		if (role !== target.role) {
			return false;
		}
		if (typeof target.name === "string") {
			return name === target.name;
		}
		return new RegExp(target.name.source, target.name.flags).test(name);
	});
	const found = matches[0];
	if (matches.length === 1 && found) {
		return found.element;
	}
	const listing = candidates.map(({ role, name }) => `  - ${role} named ${JSON.stringify(name)}`).join("\n");
	throw new Error(
		`The screen has ${matches.length} matches for ${targetName(target)}.\nhelp: Use a role and name for exactly one visible target.\nCandidates on screen:\n${listing || "  (none)"}`,
	);
}
