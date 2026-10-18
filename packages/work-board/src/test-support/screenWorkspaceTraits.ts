import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { screenStory } from "./screenStory.ts";
import { todayFixture } from "./todayFixture.ts";
export function screenFiles(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	return screenStory.trait("workspace", `the workspace contains ${Object.keys(files).join(", ")}`, (engine) => {
		engine.files = { ...files };
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
