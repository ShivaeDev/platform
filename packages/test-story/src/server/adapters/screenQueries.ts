import { isInaccessible } from "dom-accessibility-api";
import { accessibility, isRendered, targetName } from "#internal/screenAccessibility.ts";
import { screenText } from "#internal/screenText.ts";
import type { ScreenTarget } from "#screenDriver.ts";

function matchesText(value: string, expected: string | RegExp) {
	return typeof expected === "string" ? value === expected : new RegExp(expected.source, expected.flags).test(value);
}

export function screenQueries(root: () => HTMLElement, dialogs: boolean) {
	function query(selector: string) {
		const current = root();
		const found = new Set(current.querySelectorAll<HTMLElement>(selector));
		const portalRoot = current.closest("[data-story-member]") ?? current.ownerDocument;
		const portals = dialogs
			? [...portalRoot.querySelectorAll<HTMLElement>('dialog,[role="dialog"],[role="alertdialog"]')].filter((dialog) => !current.contains(dialog))
			: [];
		for (const dialog of portals) {
			if (dialog.matches(selector)) {
				found.add(dialog);
			}
			for (const child of dialog.querySelectorAll<HTMLElement>(selector)) {
				found.add(child);
			}
		}
		return [...found];
	}
	function candidates() {
		return query("*")
			.filter((element) => isRendered(element) && !isInaccessible(element))
			.map((element) => {
				const { role, name } = accessibility(element);
				return { element, name: role === "alert" && name === "" ? screenText(element).replace(/\s+/gu, " ").trim() : name, role };
			})
			.filter(({ role }) => role !== null);
	}
	function roles(target: Exclude<ScreenTarget, string>) {
		return candidates().filter(({ role, name }) => role === target.role && matchesText(name, target.name));
	}
	return {
		matches: (target: ScreenTarget) =>
			(typeof target === "string" ? query(target).filter(isRendered) : roles(target).map(({ element }) => element)).filter(
				(element) => element.isConnected,
			),
		query,
		roleElement: (target: Exclude<ScreenTarget, string>) => {
			const matches = roles(target);
			const found = matches[0];
			if (matches.length === 1 && found) {
				return found.element;
			}
			const listing = candidates()
				.map(({ role, name }) => `  - ${role} named ${JSON.stringify(name)}`)
				.join("\n");
			throw new Error(
				`The screen has ${matches.length} matches for ${targetName(target)}.\nhelp: Use a role and name for exactly one visible target.\nCandidates on screen:\n${listing || "  (none)"}`,
			);
		},
		textElement: (text: string | RegExp) => {
			const current = root();
			const matches = [current, ...query("*")].filter(
				(element) => isRendered(element) && matchesText(screenText(element).replace(/\s+/gu, " ").trim(), text),
			);
			const deepest = matches.filter((element) => !matches.some((other) => element !== other && element.contains(other)));
			const found = deepest[0];
			if (deepest.length !== 1 || found === undefined) {
				throw new Error(
					`The screen has ${deepest.length} matches for text ${String(text instanceof RegExp ? text : JSON.stringify(text))}.\nhelp: Use text that identifies exactly one visible element.`,
				);
			}
			return found;
		},
	};
}
