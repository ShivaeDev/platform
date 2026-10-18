import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

const PHONE = 'nav[aria-label="Phone navigation"]';
screenStory.it(
	"keeps primary destinations and Search available from Today, Now, goals and documents",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(todayFixture(), "/")],
	function* ({ click, navigate, readAttribute, findElements, findElement, readText }) {
		for (const url of ["/", "/_board/work", "/_board/item/project.alpha/", "/home.md"]) {
			yield* Effect.promise(() => navigate(url));
			yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe(url)));
			expect([...findElements(`${PHONE} a`)].map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
				["Today", "/"],
				["Goals", "/_board/goals"],
				["Now", "/_board/work"],
			]);
			click(`${PHONE} button[aria-controls="search-dialog"]`);
			expect(findElement("#search-dialog", document)).not.toBeNull();
			expect(findElement("#search-dialog kbd", document)).toBeNull();
			expect(findElement("#search-dialog .search-help", document)).toBeNull();
			click("#search-close");
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		}
		for (const [href, title] of [
			["/_board/goals", "Goals"],
			["/_board/work", "Now"],
			["/", "Today"],
		]) {
			click(`${PHONE} a[href="${href}"]`);
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe(title)));
			expect(readAttribute(`${PHONE} a[aria-current="page"]`, "href")).toBe(href);
		}
	},
);

screenStory.it(
	"opens Library and System through More and closes the sheet on navigation or dismissal",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(todayFixture(), "/")],
	function* ({ click, control, findElement, findElements, location }) {
		for (const href of ["/_board/library", "/_board/system"]) {
			click(`${PHONE} button[aria-controls="phone-more"]`);
			expect(findElement("#phone-more", document)).not.toBeNull();
			expect([...findElements("#phone-more a", document)].map((link) => link.textContent)).toEqual(["Library", "System"]);
			click(`#phone-more a[href="${href}"]`);
			yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe(href)));
			yield* Effect.promise(() => eventually(() => expect(findElement("#phone-more", document)).toBeNull()));
		}
		click(`${PHONE} button[aria-controls="phone-more"]`);
		click("#phone-more button");
		yield* Effect.promise(() => eventually(() => expect(findElement("#phone-more", document)).toBeNull()));
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		click("#sidebar-backdrop");
		expect(control("#sidebar", HTMLElement).hidden).toBe(true);
		click("#settings-open");
		expect(control("#theme", HTMLSelectElement).closest('[role="dialog"]')).toHaveProperty("hidden", false);
	},
);
