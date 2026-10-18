import { Effect } from "effect";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();
beforeEach(() => {
	const match = window.matchMedia.bind(window);
	vi.stubGlobal("matchMedia", (query: string) => {
		const media = match(query);
		Object.defineProperty(media, "matches", { value: query === "(max-width: 767px)" || query === "(any-pointer: coarse)" });
		return media;
	});
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const PHONE = 'nav[aria-label="Phone navigation"]';
screenStory.it(
	"keeps primary destinations and Search available from Today, Now, goals and documents",
	[chromeScreen(todayFixture(), "/")],
	function* ({ click, control, navigate }) {
		for (const url of ["/", "/_board/work", "/_board/item/project.alpha/", "/home.md"]) {
			yield* Effect.promise(() => navigate(url));
			yield* Effect.promise(() => eventually(() => expect(document.querySelector("#doc")?.getAttribute("data-route")).toBe(url)));
			expect([...document.querySelectorAll(`${PHONE} a`)].map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
				["Today", "/"],
				["Goals", "/_board/goals"],
				["Now", "/_board/work"],
			]);
			click(`${PHONE} button[aria-controls="search-dialog"]`);
			expect(control("#search-dialog", HTMLDialogElement).open).toBe(true);
			expect(document.querySelector("kbd")).toBeNull();
			expect(document.querySelector(".search-help")).toBeNull();
			click("#search-close");
		}
		for (const [href, title] of [
			["/_board/goals", "Goals"],
			["/_board/work", "Now"],
			["/", "Today"],
		]) {
			click(`${PHONE} a[href="${href}"]`);
			yield* Effect.promise(() => eventually(() => expect(document.querySelector("#doc h1")?.textContent).toBe(title)));
			expect(document.querySelector(`${PHONE} a[aria-current="page"]`)?.getAttribute("href")).toBe(href);
		}
	},
);

screenStory.it(
	"opens Library and System through More and closes the sheet on navigation or dismissal",
	[chromeScreen(todayFixture(), "/")],
	function* ({ click, control, routed }) {
		const view = routed();

		for (const href of ["/_board/library", "/_board/system"]) {
			click(`${PHONE} button[aria-controls="phone-more"]`);
			expect(control("#phone-more", HTMLDialogElement).open).toBe(true);
			expect([...document.querySelectorAll("#phone-more a")].map((link) => link.textContent)).toEqual(["Library", "System"]);
			click(`#phone-more a[href="${href}"]`);
			yield* Effect.promise(() => eventually(() => expect(view.router.state.location.pathname).toBe(href)));
			expect(control("#phone-more", HTMLDialogElement).open).toBe(false);
		}
		click(`${PHONE} button[aria-controls="phone-more"]`);
		click("#phone-more button");
		expect(control("#phone-more", HTMLDialogElement).open).toBe(false);
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		click("#sidebar-backdrop");
		expect(control("#sidebar", HTMLElement).hidden).toBe(true);
		click("#settings-open");
		expect(control("#theme", HTMLSelectElement).closest('[role="dialog"]')).toHaveProperty("hidden", false);
	},
);
