import type { EngineStory } from "#test/engineState.ts";
export function boardReadRetry(state: EngineStory, tell: (line: string) => void) {
	function source() {
		if (state.sourceReads === undefined) {
			throw new Error("No tracked Board sources are configured");
		}
		return state.sourceReads;
	}
	return {
		boardScans: () => source().scans(),
		makeBoardUnreadable: (path: string) => {
			source().unreadable.add(path);
			tell(`Board source ${path} becomes unreadable`);
		},
		restoreBoardReads: () => {
			source().unreadable.clear();
			tell("Board sources become readable again");
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
