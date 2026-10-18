import { answerList, answers } from "#test/answerStories.ts";

answers.it("Schema and server messages follow their answer through array edits", [answerList()], function* ({ click, type, messages }) {
	yield* messages([
		["first", undefined],
		["second", undefined],
		["third", undefined],
	]);
	yield* click("Save");
	yield* messages([
		["first", undefined],
		["second", undefined],
		["third", "Required"],
	]);
	yield* click("Remove first");
	yield* click("Move third first");
	yield* messages([
		["third", "Required"],
		["second", undefined],
	]);
	yield* type("third", "Valid");
	yield* click("Save");
	yield* messages([
		["third", "Answer is closed"],
		["second", undefined],
	]);
	yield* click("Restore first");
	yield* click("Move second first");
	yield* click("Move first first");
	yield* messages([
		["first", undefined],
		["second", undefined],
		["third", "Answer is closed"],
	]);
	yield* click("Remove first");
	yield* messages([
		["second", undefined],
		["third", "Answer is closed"],
	]);
	yield* click("Move third first");
	yield* messages([
		["third", "Answer is closed"],
		["second", undefined],
	]);
	yield* click("Remove third");
	yield* messages([["second", undefined]]);
});
