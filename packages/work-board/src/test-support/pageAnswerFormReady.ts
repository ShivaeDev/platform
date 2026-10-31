import { boardStory } from "./boardStory.ts";
import { pageMutation } from "./packetPageVerbs.ts";
import { connected, openReader } from "./storyEngine.ts";

export function pageAnswerFormReady() {
	return boardStory.trait("reader", "the page's answer form enables its preview", function* (engine) {
		yield* openReader(engine);
		const { page } = connected(engine);
		yield* pageMutation(
			page,
			"the answer form enabled its preview",
			() => page.document.getElementById("response-preview")?.hasAttribute("disabled") === false,
		);
	});
}
