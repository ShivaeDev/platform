import type { BoardEngine } from "./storyEngine.ts";

export function nativeVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		disconnectTransport: () => {
			tell("the native HTTP connection goes offline");
			if (!engine.connectionBoundary) {
				throw new Error("No native connection boundary was prepared");
			}
			engine.connectionBoundary.disconnect();
		},
		resumeTransport: () => {
			tell("the native HTTP connection returns");
			if (!engine.connectionBoundary) {
				throw new Error("No native connection boundary was prepared");
			}
			engine.connectionBoundary.resume();
		},
	};
}
