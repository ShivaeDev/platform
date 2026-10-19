import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

// The screen engine loads the Markdown renderers before any trait runs, so the failure covers every story in an importing file.
vi.mock("#client/react/markdownRenderers.ts", () => {
	throw new TypeError("Failed to fetch dynamically imported module");
});

export function markdownChunkFails() {
	return screenStory.trait("workspace", "the Markdown renderer chunk cannot be fetched", () => undefined);
}
