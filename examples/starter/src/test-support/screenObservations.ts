import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { screenInput } from "./screenActions.ts";
import { type Screen, screenView } from "./screenState.ts";

export function observeScreen(tell: (line: string) => void) {
	return (line: string, check: () => void) =>
		Effect.promise(async () => {
			tell(line);
			await eventually(check);
		});
}

export function screenObservations(engine: Screen, tell: (line: string) => void) {
	const observe = observeScreen(tell);
	function container() {
		return screenView(engine).container;
	}
	return {
		alertIncludes: (message: string) =>
			observe(`the alert includes ${JSON.stringify(message)}`, () => {
				expect(container().querySelector("[role=alert]")?.textContent).toContain(message);
			}),
		alertSays: (message: string) =>
			observe(`the alert says ${JSON.stringify(message)}`, () => {
				expect(container().querySelector("[role=alert]")?.textContent).toBe(message);
			}),
		draftIs: (value: string, label?: string) =>
			observe(`${label ?? "the editor"} still holds ${JSON.stringify(value)}`, () => {
				expect(screenInput(engine, label).value).toBe(value);
			}),
		headingIs: (text: string) =>
			observe(`the heading is ${JSON.stringify(text)}`, () => {
				expect(container().querySelector("h1")?.textContent).toBe(text);
			}),
		noAlert: () =>
			observe("there is no alert", () => {
				expect(container().querySelector("[role=alert]")).toBeNull();
			}),
		noSavedNotes: () =>
			observe("there are no saved notes", () => {
				expect(container().querySelector("li")).toBeNull();
			}),
		noteLinkIs: (title: string) =>
			observe(`the saved note links to ${JSON.stringify(title)}`, () => {
				expect(container().querySelector("li > a")?.textContent).toBe(title);
			}),
		routeIs: (route: string) =>
			observe(`the app is at ${route}`, () => {
				expect(engine.router?.state.location.pathname).toBe(route);
			}),
		screenOmits: (text: string) =>
			observe(`the screen omits ${JSON.stringify(text)}`, () => {
				expect(container().textContent).not.toContain(text);
			}),
		screenSays: (text: string) =>
			observe(`the screen says ${JSON.stringify(text)}`, () => {
				expect(container().textContent).toContain(text);
			}),
		signInIsOffered: () =>
			observe("sign-in is linked and the protected form is absent", () => {
				expect(container().querySelector("a")?.getAttribute("href")).toBe("/sign-in");
				expect(container().querySelector("form")).toBeNull();
			}),
	};
}
