import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationAskStateFixture } from "#test/migrationDecisionFixture.ts";

boardStory.it(
	"keeps open Fleet asks ready despite answers and closes asks from their own state, retaining selection-only answers",
	[projectFiles(migrationAskStateFixture), deferredServing],
	function* ({ migrate, start, rpc }) {
		migrate();
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		yield* start();
		for (const [id, status, answer] of [
			["selected", "ready", "release"],
			["multiple", "done", "release, retry"],
			["written", "ready", undefined],
			["closed", "done", undefined],
		]) {
			const document = yield* rpc((client) => client("work-board.document", { url: `/_board/item/fleet.${id}/` }));
			expect(document.diagnostics).toEqual([]);
			expect(document.metadata).toMatchObject({ kind: "question", scope: "task", status, urgency: status === "ready" ? "blocking" : "whenever" });
			expect(document.metadata.answer).toBe(answer);
		}
		const inbox = yield* rpc((client) => client("work-board.inbox", undefined));
		expect(inbox.items.map((item) => item.id).sort()).toEqual(["task.selected", "task.written"]);
		for (const id of ["selected", "multiple", "written", "closed"]) {
			const task = yield* rpc((client) => client("work-board.document", { url: `/_board/item/task.${id}/` }));
			expect(task.rulings).toEqual([]);
		}
	},
);
