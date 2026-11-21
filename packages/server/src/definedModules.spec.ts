import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { definedModulesHost, handWrittenNotes, queueSharedWithDrafts, queueSharedWithGreetings, replacedNotes } from "#test/defined-modules/story.ts";

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
	"a host given the defined notes module with a test fake through replacedModuleHandlers starts, answers alice from the fake and still refuses a visitor by the read policy",
	[replacedNotes],
	function* ({ readNote, startup }) {
		yield* outcomes([
			["startup", () => startup(), "started"],
			["alice reads note 1", () => readNote(1), "Fake note"],
			["a visitor reads note 1", () => readNote(1, "a visitor"), "failed with query read denied"],
		]);
	},
);

definedModulesHost.it(
	"a defined module registered with neither a name nor migrations is served beside the notes module, whose table comes from the migrations folder beside its registration",
	[],
	function* ({ createNote, greet, readNote }) {
		yield* createNote("Groceries");

		yield* outcomes([
			["alice greets Bob", () => greet("Bob"), "Hello, Bob"],
			["alice reads note 1", () => readNote(1), "Groceries"],
		]);
	},
);

definedModulesHost.it(
	"a queue declared by a hand-written module and by a defined module registered without a name is refused, naming both by their module names",
	[queueSharedWithGreetings],
	function* ({ startup }) {
		expect(yield* startup()).toBe('Queue "drafts.publish" is declared by both "drafts" and "greetings".');
	},
);

definedModulesHost.it(
	"a registration that brings only an admin page, with no group, handlers, name or services, is served beside the modules",
	[],
	function* ({ createNote, readUsage }) {
		yield* createNote("Groceries");

		expect(yield* readUsage()).toEqual(["Groceries"]);
	},
);

definedModulesHost.it(
	"a queue declared by the drafts module and by a registration with no name but an admin page is refused, naming that registration by its admin page",
	[queueSharedWithDrafts("the usage report")],
	function* ({ startup }) {
		expect(yield* startup()).toBe('Queue "drafts.publish" is declared by both "drafts" and the registration of admin page "usage".');
	},
);

definedModulesHost.it(
	"a queue declared by the drafts module and by a registration with neither a name nor an admin page is refused, saying it has no name and to give it one",
	[queueSharedWithDrafts("the reminders registration")],
	function* ({ startup }) {
		expect(yield* startup()).toBe(
			'Queue "drafts.publish" is declared by both "drafts" and a registration with no name. Give the registration with no name a `name` so this message can name it.',
		);
	},
);
