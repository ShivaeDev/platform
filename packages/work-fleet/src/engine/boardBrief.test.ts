import { expect, it } from "vitest";
import { refreshedBrief } from "#engine/boardBrief.ts";
import type { BoardWork } from "#policy.ts";
import { statusRecord } from "#test/status.ts";

it("inserts refreshed task text literally, including dollar replacement patterns", () => {
	const previous = "# Previous task\nOriginal criteria.\n";
	const context = "# Current task\nKeep $& unchanged.\nKeep $$ unchanged.\nKeep $` unchanged.\nKeep $' unchanged.\n";
	const work: BoardWork = {
		approved: true,
		context,
		dependsOn: [],
		revision: "current-revision",
		sourcePath: "task.md",
		workId: "synthetic-work",
	};
	const record = {
		...statusRecord(work.workId, "prepared"),
		boardContext: previous,
		prompt: `Worker guidance before the task.\n\n${previous}\nWorker guidance after the task.`,
	};

	const refreshed = refreshedBrief(record, work);

	expect(refreshed.prompt).toBe(`Worker guidance before the task.\n\n${context}\nWorker guidance after the task.`);
	expect(refreshed.boardContext).toBe(context);
	expect(refreshed.boardRevision).toBe(work.revision);
});
