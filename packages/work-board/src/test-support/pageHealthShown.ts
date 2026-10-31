import { screenStory } from "./screenStory.ts";

export function pageHealthShown() {
	return screenStory.trait("workspace", "the screen shows whether Today's read is pending, settled or failed", (engine) => {
		engine.health = true;
	});
}
