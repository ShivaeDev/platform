import { expect } from "vitest";
import { answerList, answers } from "#test/answerStories.ts";

answers.it("Schema and server messages follow their answer through array edits", [answerList()], function* ({ click, type, messages, observe }) {
	yield* observe("the initial answers have no messages", () => {
		expect(messages()).toEqual([
			["first", undefined],
			["second", undefined],
			["third", undefined],
		]);
	});
	yield* click("Save");
	yield* observe("the required answer has a Schema message", () => {
		expect(messages()).toEqual([
			["first", undefined],
			["second", undefined],
			["third", "Required"],
		]);
	});
	yield* click("Remove first");
	yield* click("Move third first");
	yield* observe("the Schema message follows reordering", () => {
		expect(messages()).toEqual([
			["third", "Required"],
			["second", undefined],
		]);
	});
	yield* type("third", "Valid");
	yield* click("Save");
	yield* observe("the server rejection attaches to its answer", () => {
		expect(messages()).toEqual([
			["third", "Answer is closed"],
			["second", undefined],
		]);
	});
	yield* click("Restore first");
	yield* click("Move second first");
	yield* click("Move first first");
	yield* observe("the server message survives restoring and reordering", () => {
		expect(messages()).toEqual([
			["first", undefined],
			["second", undefined],
			["third", "Answer is closed"],
		]);
	});
	yield* click("Remove first");
	yield* observe("the server message survives removal", () => {
		expect(messages()).toEqual([
			["second", undefined],
			["third", "Answer is closed"],
		]);
	});
	yield* click("Move third first");
	yield* observe("the server message follows its moved answer", () => {
		expect(messages()).toEqual([
			["third", "Answer is closed"],
			["second", undefined],
		]);
	});
	yield* click("Remove third");
	yield* observe("removing the rejected answer removes its message", () => {
		expect(messages()).toEqual([["second", undefined]]);
	});
});
