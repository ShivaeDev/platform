import { mountSession } from "./mountSession.ts";
import { screenSettles } from "./screenSettle.ts";
import { screenStory } from "./screenStory.ts";

export function answerAuthor(workspace: string, author: string) {
	return screenStory.trait("workspace", `the browser remembers ${author} as the answer author in workspace ${workspace}`, () => {
		document.documentElement.dataset.workspace = workspace;
		localStorage.setItem(`work-board:author:${workspace}`, author);
	});
}

export function liveForm(kind: "response" | "handoff") {
	return screenStory.trait("screen", `the reader opens the ${kind === "response" ? "answer" : "handoff"} form in a live session`, function* (engine) {
		engine.session = yield* mountSession(engine, kind);
		yield* screenSettles(engine, () => undefined);
	});
}
