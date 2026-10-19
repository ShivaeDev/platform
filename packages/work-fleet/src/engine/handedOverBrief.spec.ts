import { expect } from "vitest";
import { fleetBoardStory } from "#test/fleetBoardStory.ts";

const HANDED_OVER = "This happens when the task now names an owner other than Codex, for example a person.";
const WAY_FORWARD = "If Codex should do it as prepared, undo the edit on the Board, then try again.";

fleetBoardStory.it("a prepared task handed to a person says what changed and starts once the edit is undone", [], function* (fleet) {
	yield* fleet.prepare();
	const prepared = yield* fleet.readSource("one.md");
	yield* fleet.handBriefToPerson();
	const stopped = (yield* fleet.dispatch()).value;
	expect(stopped.decision?.reason).toBe("Board context changed");
	const card = yield* fleet.readSource(stopped.decision?.published?.sourcePath ?? "");
	expect(card).toContain(HANDED_OVER);
	expect(card).toContain(WAY_FORWARD);
	expect(card).toContain("Try again after undoing the edit");
	yield* fleet.undoBriefEdit();
	yield* fleet.answerDecision("retry");
	const started = (yield* fleet.dispatch()).value;
	expect(started.stage).toBe("executing");
	expect(started.attempts.map((attempt) => attempt.role)).toEqual(["worker"]);
	expect(started.boardContext).toBe(prepared);
});
