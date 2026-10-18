import { boardHome, boardStory, projectFiles, readerAt } from "./boardStory.ts";
import { FILES } from "./live.ts";
import { REVIEW_TASK, reviewResult } from "./resultReview.ts";
import { sidebarWorkspace } from "./sidebarFixture.ts";

export function navigationWorkspace() {
	return boardStory.traits(
		projectFiles({ ...FILES, "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK }),
		boardHome("board.md"),
		readerAt("/"),
	);
}
export function samplePages() {
	return boardStory.traits(projectFiles(FILES), boardHome("board.md"), readerAt("/"));
}
export function searchablePage() {
	return boardStory.traits(
		projectFiles({ "note.md": "# Plan\n\n## Evidence\n\nKnown phrase.\n\n## Evidence\n\nSecond phrase." }),
		readerAt("/note.md"),
	);
}
export function sidebarPages() {
	return boardStory.traits(projectFiles(sidebarWorkspace()), boardHome("board.md"), readerAt("/"));
}
