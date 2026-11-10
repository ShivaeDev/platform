import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { definedModulesHost, handWrittenNotes, replacedNotes } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"one host serves the hand-written drafts module and the defined notes module side by side, each answering a success and a rejection",
	[],
	function* ({ createNote, readDraft }) {
		yield* outcomes([
			["alice creates Groceries", () => createNote("Groceries"), "Groceries"],
			["alice creates Groceries again", () => createNote("Groceries"), "failed with title taken"],
			["the draft Plan", () => readDraft("Plan"), "Plan"],
			["the draft Holiday", () => readDraft("Holiday"), "failed with draft missing"],
		]);
	},
);

definedModulesHost.it(
	"a visitor reading a note through the defined module's query without a declared read policy is refused, while alice reads it",
	[],
	function* ({ createNote, readNote }) {
		yield* createNote("Groceries");

		yield* outcomes([
			["a visitor", () => readNote(1, "a visitor"), "failed with query read denied"],
			["alice", () => readNote(1), "Groceries"],
		]);
	},
);

definedModulesHost.it(
	"a host given the defined notes module with hand-written handlers refuses to start, naming the module and its query",
	[handWrittenNotes],
	function* ({ startup }) {
		expect(yield* startup()).toBe(
			"Module \"notes\" serves notes.get through hand-written handlers instead of its generated ones, which check each query's read policy with the module's services. Register it as `module:` instead of `group` and `handlers`.",
		);
	},
);

definedModulesHost.it(
	"a host given the defined notes module with a test fake through replacedModuleHandlers starts and answers alice from the fake",
	[replacedNotes],
	function* ({ readNote, startup }) {
		yield* outcomes([
			["startup", () => startup(), "started"],
			["alice reads note 1", () => readNote(1), "Fake note"],
		]);
	},
);
