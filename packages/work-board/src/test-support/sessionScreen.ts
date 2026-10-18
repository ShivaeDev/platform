import { mountSession } from "./mountSession.ts";
import { screenStory } from "./screenStory.ts";
export function sessionScreen(kind: "response" | "handoff") {
	return screenStory.trait("screen", `the reader opens the ${kind} form in a live session`, function* (engine) {
		engine.session = yield* mountSession(engine, kind);
	});
}
