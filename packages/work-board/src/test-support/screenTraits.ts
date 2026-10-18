import { Deferred, Effect } from "effect";
import { eventually, render } from "@shivaedev/effect-react/testing.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { answerDraft } from "./answerDraft.tsx";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { renderBoard } from "./react.tsx";
import { renderRouter } from "./renderRouter.tsx";
import { trackScreen } from "./screenEngine.ts";
import { readingContent, screenClient, screenContent } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenStory } from "./screenStory.ts";
import { todayFixture } from "./todayFixture.ts";
export function screenFiles(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	return screenStory.trait("workspace", `the workspace contains ${Object.keys(files).join(", ")}`, (engine) => {
		engine.files = files;
		engine.options = options;
	});
}
export function screenRoute(path: string) {
	return screenStory.trait("workspace", `the reader starts at ${path}`, (engine) => {
		engine.path = path;
	});
}
export function screenTheme(theme: "light" | "dark" | "system") {
	return screenStory.trait("workspace", `the reader prefers the ${theme} theme`, () => {
		localStorage.setItem(`work-board:appearance:${document.documentElement.dataset.workspace}`, JSON.stringify({ theme }));
		document.documentElement.dataset.theme = theme;
		document.documentElement.classList.toggle("dark", theme === "dark");
	});
}
export function storedScreenState(values: Readonly<Record<string, string>>) {
	return screenStory.trait("workspace", `the browser remembers ${Object.keys(values).join(", ")}`, () => {
		for (const [key, value] of Object.entries(values)) {
			localStorage.setItem(key, value);
		}
	});
}
export function screenFleet(fleet: FleetItemsProjection) {
	return screenStory.trait("workspace", "Fleet supplies its current work items", (engine) => {
		engine.fleet = fleet;
	});
}
export function todayScreen() {
	return screenFiles(todayFixture(), { home: "home.md" });
}

export function openScreen() {
	return screenStory.trait("screen", "the reader opens the configured route", function* (engine) {
		const view = yield* Effect.promise(() =>
			renderRouter(engine.files, engine.path, screenOptions(engine, engine.options), (api) => screenClient(engine, api)),
		);
		engine.router = view.router;
		engine.routed = trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
export function routedScreen(files: Parameters<typeof renderRouter>[0], path: string, options?: BoardFixtureOptions) {
	return screenStory.traits(screenFiles(files, options), screenRoute(path), openScreen());
}
export function chromeScreen(files: Parameters<typeof renderRouter>[0], path = "/notes/plan.md") {
	return screenStory.traits(
		routedScreen(files, path),
		screenStory.trait("screen", `the shell finishes opening ${path}`, function* (engine) {
			yield* Effect.promise(() =>
				eventually(() => {
					if (engine.view?.container.querySelector("#doc")?.getAttribute("data-route") !== path) {
						throw new Error(`The shell is still opening ${path}`);
					}
				}),
			);
		}),
	);
}
export function componentScreen(...args: Parameters<typeof import("@shivaedev/effect-react/testing.ts").render>) {
	return screenStory.trait("screen", "the reader opens the feature's component", function* (engine) {
		trackScreen(engine, yield* Effect.promise(() => render(screenContent(engine, args[0]))), (line) => engine.tell?.(line));
	});
}
export function boardScreen(...args: Parameters<typeof import("./react.tsx").renderBoard>) {
	return screenStory.trait("screen", `the reader opens a Board screen with ${Object.keys(args[0]).join(", ")}`, function* (engine) {
		engine.boardScreen = trackScreen(
			engine,
			yield* Effect.promise(() =>
				renderBoard(
					args[0],
					(api, registry) => {
						screenClient(engine, api);
						return screenContent(engine, args[1](api, registry));
					},
					args[2],
				),
			),
			(line) => engine.tell?.(line),
		);
	});
}

export function answerScreen(...args: Parameters<typeof answerDraft>) {
	return componentScreen(answerDraft(...args));
}
export function readingScreen(kind: string) {
	return componentScreen(readingContent(kind));
}

export function pausedDocument(url: string) {
	return screenStory.trait("workspace", `the document read for ${url} waits`, function* (engine) {
		const gate = yield* Deferred.make<void>();
		engine.heldRead = { gate, started: false, url };
		yield* Effect.addFinalizer(() => Deferred.succeed(gate, undefined));
	});
}
