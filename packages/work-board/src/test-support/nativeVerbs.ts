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
		loseNextChange: () => {
			tell("the live delivery boundary drops the next server change");
			if (!engine.changeDelivery) {
				throw new Error("No delivery fault was prepared");
			}
			engine.changeDelivery.loseNext = true;
		},
		omitNextPath: (path: string) => {
			tell(`the next live message omits the observed edit to ${path}`);
			if (!engine.changeDelivery) {
				throw new Error("No delivery fault was prepared");
			}
			engine.changeDelivery.omitPath = path;
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
