import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

export function screenWorkspace(name: string) {
	return screenStory.trait("workspace", `the browser opens workspace ${name}`, () => {
		document.documentElement.dataset.workspace = name;
	});
}

export function screenMedia(matches: readonly string[], touchPoints = 0) {
	return screenStory.trait("workspace", `the browser matches ${matches.join(", ")} with ${touchPoints} touch points`, () => {
		const match = window.matchMedia.bind(window);
		vi.stubGlobal("navigator", Object.create(window.navigator, { maxTouchPoints: { value: touchPoints } }));
		vi.stubGlobal("matchMedia", (query: string) => {
			const media = match(query);
			Object.defineProperty(media, "matches", { value: matches.includes(query) });
			return media;
		});
	});
}

export function screenHistory(state: unknown, path = "/") {
	return screenStory.trait("workspace", `the browser remembers history at ${path}`, () => window.history.replaceState(state, "", path));
}

export function screenSession(values: Readonly<Record<string, string>>) {
	return screenStory.trait("workspace", "the browser remembers this session", () => {
		for (const [key, value] of Object.entries(values)) {
			window.sessionStorage.setItem(key, value);
		}
	});
}

export function fallibleDocument() {
	return screenStory.trait("workspace", "document reads can become unavailable", (engine) => {
		engine.documentFailed = false;
	});
}

export function unavailableWorkspace() {
	return screenStory.trait("workspace", "the workspace index is temporarily unavailable", (engine) => {
		engine.indexFailed = true;
		engine.health = true;
	});
}
