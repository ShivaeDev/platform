import { isInaccessible } from "dom-accessibility-api";
import { isRendered } from "#server/adapters/screenAccessibility.ts";
import { screenQueries } from "#server/adapters/screenQueries.ts";
import { screenText } from "#server/screenText.ts";

export function screenLoading(root: () => HTMLElement, dialogs: boolean) {
	const queries = screenQueries(root, dialogs);
	const indicators = '[role~="status"],[aria-busy="true"],dialog[open],[role~="dialog"],[role~="alertdialog"]';
	function visible(element: HTMLElement) {
		return element.isConnected && element.closest("dialog:not([open])") === null && isRendered(element) && !isInaccessible(element);
	}
	return () => {
		const current = root();
		if ([current, ...queries.query(indicators)].some((element) => element.matches(indicators) && visible(element))) {
			return true;
		}
		return [current, ...queries.query("*")].some(
			(element) => visible(element) && /^Loading(?:…|\.{3})$/iu.test(screenText(element).replace(/\s+/gu, " ").trim()),
		);
	};
}
