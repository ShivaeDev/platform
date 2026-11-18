import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { themeStorage } from "#client/adapters/themeStorage.ts";
import { startApp } from "#client/startApp.tsx";
import { appAuth } from "#test-support/appAuth.ts";

function rootElement() {
	const root = document.getElementById("root");
	if (root === null) {
		throw new Error("The page has no #root; load the page first");
	}
	return root;
}

export const bootPage = storyKit({
	*create() {
		// happy-dom replaces the global URL, so the page's path is joined instead of resolved as a file URL.
		const html = yield* Effect.promise(() => readFile(join(import.meta.dirname, "../../index.html"), "utf8"));
		const system = { dark: false };
		yield* Effect.acquireRelease(
			Effect.sync(() => {
				Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
				const original = globalThis.matchMedia;
				const media = vi.spyOn(globalThis, "matchMedia").mockImplementation((query) => {
					const list = original(query);
					Object.defineProperty(list, "matches", { get: () => system.dark });
					return list;
				});
				const marks = [...document.documentElement.attributes].map(({ name, value }) => [name, value] as const);
				return { body: document.body.innerHTML, href: location.href, marks, media, saved: localStorage.getItem("theme") };
			}),
			({ body, href, marks, media, saved }) =>
				Effect.sync(() => {
					media.mockRestore();
					for (const { name } of [...document.documentElement.attributes]) {
						document.documentElement.removeAttribute(name);
					}
					for (const [name, value] of marks) {
						document.documentElement.setAttribute(name, value);
					}
					document.body.innerHTML = body;
					history.replaceState(null, "", href);
					if (saved === null) {
						localStorage.removeItem("theme");
					} else {
						localStorage.setItem("theme", saved);
					}
				}),
		);
		return { html, system };
	},
	name: "boot page",
	stages: ["browser"],
	verbs: (engine, { tell }) => ({
		bundleRuns: () =>
			Effect.gen(function* () {
				tell("the bundle runs and starts the app in the page's root");
				const auth = appAuth({ baseUrl: location.origin }).auth;
				yield* Effect.acquireRelease(
					Effect.promise(() => act(() => startApp(rootElement(), auth))),
					(root) => Effect.sync(() => act(() => root.unmount())),
				);
			}),
		documentMarks: () => Effect.sync(() => [...document.documentElement.attributes].map(({ name, value }) => `${name}="${value}"`)),
		outline: () => Effect.sync(() => (rootElement().querySelector("#boot-outline") === null ? "gone" : "shown")),
		pageLoads: () =>
			Effect.sync(() => {
				tell("the browser parses the page and runs its inline scripts, before the bundle arrives");
				const page = new DOMParser().parseFromString(engine.html, "text/html");
				for (const { name } of [...document.documentElement.attributes]) {
					document.documentElement.removeAttribute(name);
				}
				for (const { name, value } of [...page.documentElement.attributes]) {
					document.documentElement.setAttribute(name, value);
				}
				document.body.innerHTML = page.getElementById("root")?.outerHTML ?? "";
				for (const script of page.querySelectorAll("script:not([src])")) {
					new Function(script.textContent)();
				}
			}),
		themeControl: () => Effect.sync(() => (rootElement().querySelector("select") === null ? "missing" : "shown")),
	}),
});

export function savedChoice(theme: string) {
	return bootPage.trait("browser", `an earlier visit saved ${theme} through the app's theme storage`, () =>
		Effect.sync(() => themeStorage.write(theme)),
	);
}

export function systemPrefers(scheme: "light" | "dark") {
	return bootPage.trait("browser", `the system prefers ${scheme}`, (engine) =>
		Effect.sync(() => {
			engine.system.dark = scheme === "dark";
		}),
	);
}

export const storageBlocked = bootPage.trait("browser", "reaching browser storage throws", () =>
	Effect.acquireRelease(
		Effect.sync(() =>
			vi.spyOn(globalThis, "localStorage", "get").mockImplementation(() => {
				throw new DOMException("Storage blocked", "SecurityError");
			}),
		),
		(spy) => Effect.sync(() => spy.mockRestore()),
	).pipe(Effect.asVoid),
);
