import type { EngineStory } from "#test/engineState.ts";
export function boardReadRetry(state: EngineStory, tell: (line: string) => void) {
	function source() {
		if (state.sourceReads === undefined) {
			throw new Error("No tracked Board sources are configured");
		}
		return state.sourceReads;
	}
	return {
		makeBoardUnreadable: (path: string) => {
			tell(`Board source ${path} becomes unreadable`);
			source().unreadable.add(path);
			return source().refresh();
		},
		restoreBoardReads: () => {
			tell("Board sources become readable again");
			source().unreadable.clear();
			return source().refresh();
		},
		resumeAcknowledgements: () => {
			if (!state.acknowledgementsPaused) {
				throw new Error("Acknowledgements are not paused");
			}
			state.acknowledgementsPaused = false;
			tell("Board acknowledgements resume");
		},
		writeTrackedBoard: (path: string, text: string) => {
			tell(`write tracked Board source ${path}`);
			return source().write(path, text);
		},
	};
}
