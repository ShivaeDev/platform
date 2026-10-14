import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import { expect, it } from "vitest";
import { INITIAL_THEME_SCRIPT } from "./initialTheme.ts";
import { shell } from "./shell.ts";

it.each([
	['{"theme":"dark"}', "light", "dark"],
	['{"theme":"light"}', "dark", "light"],
	['{"theme":"system"}', "dark", "dark"],
	["{}", "light", "light"],
	['{"theme":"other"}', "dark", "dark"],
	["null", "dark", "dark"],
	["invalid", "dark", "dark"],
])("initializes saved %s with system %s before React mounts", async (saved, system, expected) => {
	const browser = new Window({ settings: { device: { prefersColorScheme: system } }, url: "http://127.0.0.1" });
	try {
		browser.document.documentElement.dataset.workspace = "theme-fixture";
		browser.localStorage.setItem("work-board:appearance:theme-fixture", saved);
		runInNewContext(INITIAL_THEME_SCRIPT, {
			document: browser.document,
			localStorage: browser.localStorage,
			matchMedia: browser.matchMedia.bind(browser),
		});
		expect(browser.document.documentElement.dataset.scheme).toBe(expected);
		expect(browser.document.documentElement.classList.contains("dark")).toBe(expected === "dark");
	} finally {
		await browser.happyDOM.close();
	}
});

it("uses the system theme when storage is unavailable", async () => {
	const browser = new Window({ settings: { device: { prefersColorScheme: "dark" } } });
	try {
		runInNewContext(INITIAL_THEME_SCRIPT, {
			document: browser.document,
			localStorage: {
				getItem: () => {
					throw new Error("Storage unavailable");
				},
			},
			matchMedia: browser.matchMedia.bind(browser),
		});
		expect(browser.document.documentElement.classList.contains("dark")).toBe(true);
	} finally {
		await browser.happyDOM.close();
	}
});

it("places theme initialization before the stylesheets and React entry", () => {
	const html = shell("plan.md", "", "", "theme-fixture", false);
	const initialization = html.indexOf('<script src="/_board/theme.js"></script>');
	expect(initialization).toBeGreaterThan(html.indexOf("<head>"));
	expect(initialization).toBeLessThan(html.indexOf('<link rel="stylesheet"'));
	expect(initialization).toBeLessThan(html.indexOf('<script type="module"'));
});
