import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { hostedHealthScreen } from "#test/hostedHealthScreen.tsx";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

const PHONE = 'nav[aria-label="Phone navigation"]';
screenStory.it(
	"keeps primary destinations and Search available from Today, Now, goals and documents",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(todayFixture(), "/")],
	function* ({ click, navigate, readAttribute, findElements, findElement, readText, roles }) {
		for (const url of ["/", "/_board/work", "/_board/item/project.alpha/", "/home.md"]) {
			yield* Effect.promise(() => navigate(url));
			yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe(url)));
			expect([...findElements(`${PHONE} a`)].map((link) => [roles.accessible(link).name, link.getAttribute("href")])).toEqual([
				["Today, 7 need you", "/"],
				["Goals", "/_board/goals"],
				["Now", "/_board/work"],
			]);
			click([...findElements(`${PHONE} button`)].find((button) => button.textContent === "Search"));
			expect(findElement("#search-dialog", document)).not.toBeNull();
			expect(findElement("#search-dialog kbd", document)).toBeNull();
			expect(readText("#search-dialog", document)).not.toContain("Enter to open");
			yield* roles.click({ name: "Close", role: "button" });
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
	function* ({ click, control, findElement, findElements, location, roles }) {
		for (const href of ["/_board/library", "/_board/system"]) {
			click(`${PHONE} button[aria-controls="phone-more"]`);
			expect(findElement("#phone-more", document)).not.toBeNull();
			expect(findElements('[aria-label="More destinations"] a', document).map((link) => roles.accessible(link).name)).toEqual(["Library", "System"]);
			click(`#phone-more a[href="${href}"]`);
			yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe(href)));
			yield* Effect.promise(() => eventually(() => expect(findElement("#phone-more", document)).toBeNull()));
		}
		click(`${PHONE} button[aria-controls="phone-more"]`);
		yield* roles.click({ name: "Close", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(findElement("#phone-more", document)).toBeNull()));
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		click("#sidebar-backdrop");
		expect(control("#sidebar", HTMLElement).hidden).toBe(true);
		click("#settings-open");
		expect(roles.text({ name: "Theme", role: "group" })).toContain("System");
	},
);

const LIVE = "#live";
screenStory.it(
	"keeps the phone's live status region empty while nothing is wrong with the connection",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), hostedHealthScreen("connecting")],
	function* ({ findElement, readAttribute, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute(LIVE, "data-state")).toBe("connecting")));
		expect(roles.accessible(findElement(LIVE) ?? document.body).role).toBe("status");
		expect(findElement(LIVE)?.textContent).toBe("");
	},
);

screenStory.it(
	"tells a phone reader when the connection is reconnecting or a refresh failed",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), hostedHealthScreen()],
	function* ({ click, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(`${LIVE} .sr-only`)).toBe("reconnecting")));
		expect(readText(`${LIVE} span[aria-hidden="true"]`)).toBe("reconnecting");
		expect(findElement(`${LIVE} svg`)).not.toBeNull();
		click("[data-document]");
		yield* Effect.promise(() => eventually(() => expect(readText(`${LIVE} .sr-only`)).toBe("refresh failed")));
		expect(readText(`${LIVE} span[aria-hidden="true"]`)).toBe("refresh failed");
	},
);

screenStory.it(
	"tells a phone reader that updates are paused",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), hostedHealthScreen("live", "paused")],
	function* ({ readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(`${LIVE} .sr-only`)).toBe("updates paused · 0 pending updates")));
		expect(readText(`${LIVE} span[aria-hidden="true"]`)).toBe("paused");
		expect(readAttribute(LIVE, "data-state")).toBe("paused");
	},
);
