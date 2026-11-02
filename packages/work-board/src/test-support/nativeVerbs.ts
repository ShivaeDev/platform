import { present } from "./liveState.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function nativeVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function transport() {
		return present(engine.connectionBoundary, "No native connection boundary was prepared");
	}
	return {
		disconnectTransport: () => {
			tell("the socket proxy closes its connections and goes offline");
			transport().disconnect();
		},
		holdTransport: () => {
			tell("the socket proxy pauses traffic on its open connections");
			transport().hold();
		},
		resumeTransport: () => {
			tell("the socket proxy resumes traffic and accepts connections");
			transport().resume();
		},
	};
}
