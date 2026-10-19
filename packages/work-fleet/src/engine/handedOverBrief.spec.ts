import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { publishedBoardDecisions } from "#test/publishedBoardDecisions.ts";

const HANDED_OVER = "This happens when the task now names an owner other than Codex, for example a person.";
const WAY_FORWARD = "If Codex should do it as prepared, undo the edit on the Board, then try again.";

isolatedEngine.it(
	"a prepared task handed to a person says what changed and starts once the edit is undone",
	[publishedBoardDecisions],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		const prepared = fleet.readBoardWork("one.md");
		fleet.writeBoardWork("one.md", `${prepared.replace("fleet: approved", "fleet: approved\nowner: human")}\nRevised scope for a person.\n`);
		const stopped = (yield* fleet.dispatch("one")).value;
		expect(stopped.decision?.reason).toBe("Board context changed");
		const card = fleet.readBoardWork(stopped.decision?.published?.sourcePath ?? "");
		expect(card).toContain(HANDED_OVER);
		expect(card).toContain(WAY_FORWARD);
		expect(card).toContain("Try again after undoing the edit");
		fleet.writeBoardWork("one.md", prepared);
		yield* fleet.answerPublishedDecision("one", "retry");
		const started = (yield* fleet.dispatch("one")).value;
		expect(started.stage).toBe("executing");
		expect(started.attempts.map((attempt) => attempt.role)).toEqual(["worker"]);
		expect(started.boardContext).toBe(prepared);
	},
);
