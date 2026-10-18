import { rawGet } from "./board.ts";
import { boardStory } from "./boardStory.ts";
import { served } from "./storyEngine.ts";

export function savedAppearance(saved: string | undefined, system: "light" | "dark") {
	return boardStory.trait("reader", `the reader saved ${saved ?? "unavailable storage"} and the system prefers ${system}`, function* (engine) {
		const html = (yield* rawGet(served(engine).board, "/")).body;
		const workspace = /data-workspace="(?<workspace>[^"]+)"/u.exec(html)?.groups?.workspace;
		if (!workspace) {
			throw new Error("The served shell has no workspace identity");
		}
		engine.beforeScripts = (window) => {
			const original = window.matchMedia.bind(window);
			window.matchMedia = (query) => {
				const media = original(query);
				if (query.includes("prefers-color-scheme")) {
					Object.defineProperty(media, "matches", { value: query.includes(system) });
				}
				return media;
			};
			if (saved === undefined) {
				Object.defineProperty(window, "localStorage", {
					value: {
						getItem: () => {
							throw new Error("Storage unavailable");
						},
					},
				});
			} else {
				window.localStorage.setItem(`work-board:appearance:${workspace}`, saved);
			}
		};
	});
}
