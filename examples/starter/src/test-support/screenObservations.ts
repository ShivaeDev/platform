import { screenInput } from "#test-support/screenActions.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function screenObservations(engine: ScreenSurface) {
	function container() {
		return screenView(engine).container;
	}
	return {
		alert: () => container().querySelector("[role=alert]")?.textContent,
		draft: (label?: string) => screenInput(engine, label).value,
		form: () => container().querySelector("form"),
		heading: () => container().querySelector("h1")?.textContent,
		noteLink: () => container().querySelector("tbody td a")?.textContent,
		savedNote: () => container().querySelector("tbody td a")?.closest("tr") ?? null,
		screenText: () => container().textContent,
		signInLink: () => container().querySelector("a")?.getAttribute("href"),
	};
}
