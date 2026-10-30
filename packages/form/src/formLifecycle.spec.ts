import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { entries, names } from "#test/lifecycle.ts";

names.it(
	"a save receives the trimmed name while the input keeps the typed spaces",
	[names.edited("name", "  Saved  ")],
	function* ({ savedValue, shown, submit }) {
		yield* submit();

		yield* outcomes({
			"saved name": [savedValue(), { name: "Saved" }],
			"shown name": [shown("name"), "  Saved  "],
		});
	},
);

names.it("a successful save leaves nothing unsaved", [names.edited("name", "  Saved  ")], function* ({ submit, unsavedChanges }) {
	expect(yield* unsavedChanges()).toBe(true);

	yield* submit();

	expect(yield* unsavedChanges()).toBe(false);
});

names.it(
	"after a successful save, typing the starting name back is an unsaved change",
	[names.edited("name", "Saved"), names.submitted()],
	function* ({ enter, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(false);

		yield* enter("name", "First");

		expect(yield* unsavedChanges()).toBe(true);
	},
);

names.it(
	"a save the server rejects keeps the typed name unsaved",
	[names.serverRejects("name", "Already used"), names.edited("name", "Taken")],
	function* ({ shown, submit, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* submit();

		yield* outcomes({
			"shown name": [shown("name"), "Taken"],
			"unsaved changes": [unsavedChanges(), true],
		});
	},
);

names.it(
	"a save that succeeds after a mid-save edit stores the submitted name and keeps the edit unsaved",
	[names.edited("name", "Submitted"), names.saveInFlight(), names.edited("name", "Still editing")],
	function* ({ finishSave, savedValue, shown, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* finishSave();

		yield* outcomes({
			"saved name": [savedValue(), { name: "Submitted" }],
			"shown name": [shown("name"), "Still editing"],
			"unsaved changes": [unsavedChanges(), true],
		});
	},
);

names.it(
	"a save that succeeds mid-edit makes the submitted name the baseline, so typing it back leaves nothing unsaved",
	[names.edited("name", "Submitted"), names.saveInFlight(), names.edited("name", "Still editing"), names.saveAnswered()],
	function* ({ enter, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* enter("name", "Submitted");

		expect(yield* unsavedChanges()).toBe(false);
	},
);

names.it(
	"a rejection that arrives after the name was edited does not show on the newer name",
	[names.serverRejects("name", "Submitted name is taken"), names.edited("name", "Submitted"), names.saveInFlight(), names.edited("name", "Newer")],
	function* ({ feedbackOn, finishSave }) {
		yield* finishSave();

		expect(yield* feedbackOn("name")).toBeUndefined();
	},
);

names.it(
	"a save that succeeds after a refresh arrived during it leaves the submitted name saved",
	[names.edited("name", "  Saved  "), names.saveInFlight(), names.refreshReceived({ name: "Saved" })],
	function* ({ finishSave, shown, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* finishSave();

		yield* outcomes({
			"shown name": [shown("name"), "  Saved  "],
			"unsaved changes": [unsavedChanges(), false],
		});
	},
);

names.it(
	"after a save that a refresh overtook, reverting restores the refreshed name",
	[names.edited("name", "  Saved  "), names.saveInFlight(), names.refreshReceived({ name: "Saved" }), names.saveAnswered()],
	function* ({ revert, shown }) {
		expect(yield* shown("name")).toBe("  Saved  ");

		yield* revert();

		expect(yield* shown("name")).toBe("Saved");
	},
);

names.it(
	"a save that succeeds after a refresh and a newer edit keeps the newer name unsaved",
	[names.edited("name", "Submitted"), names.saveInFlight(), names.refreshReceived({ name: "Remote" }), names.edited("name", "Newer")],
	function* ({ finishSave, shown, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* finishSave();

		yield* outcomes({
			"shown name": [shown("name"), "Newer"],
			"unsaved changes": [unsavedChanges(), true],
		});
	},
);

names.it(
	"after a save that a refresh and a newer edit overtook, typing the refreshed name back leaves nothing unsaved",
	[
		names.edited("name", "Submitted"),
		names.saveInFlight(),
		names.refreshReceived({ name: "Remote" }),
		names.edited("name", "Newer"),
		names.saveAnswered(),
	],
	function* ({ enter, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* enter("name", "Remote");

		expect(yield* unsavedChanges()).toBe(false);
	},
);

names.it(
	"after a save that a stale refresh overtook, the next refresh replaces the submitted name",
	[names.edited("name", "Submitted"), names.saveInFlight(), names.refreshReceived({ name: "First" }), names.saveAnswered()],
	function* ({ refresh, shown }) {
		expect(yield* shown("name")).toBe("Submitted");

		yield* refresh({ name: "Submitted by server" });

		expect(yield* shown("name")).toBe("Submitted by server");
	},
);

names.it(
	"resubmitting while the first save waits saves the latest name and leaves nothing unsaved",
	[names.edited("name", "One"), names.saveInFlight(), names.refreshReceived({ name: "Remote" }), names.edited("name", "Two")],
	function* ({ savedValue, submit, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* submit();

		yield* outcomes({
			"saved name": [savedValue(), { name: "Two" }],
			"unsaved changes": [unsavedChanges(), false],
		});
	},
);

names.it(
	"after resubmitting while the first save waits, typing the refreshed name back is an unsaved change",
	[names.edited("name", "One"), names.saveInFlight(), names.refreshReceived({ name: "Remote" }), names.edited("name", "Two"), names.submitted()],
	function* ({ enter, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(false);

		yield* enter("name", "Remote");

		expect(yield* unsavedChanges()).toBe(true);
	},
);

entries.it(
	"after a save, a refresh replaces the saved name with the server's trimmed one and keeps an edited note",
	[entries.edited("name", "  Saved  "), entries.submitted(), entries.edited("note", "  local  ")],
	function* ({ refresh, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "  Saved  ", note: "  local  " });

		yield* refresh({ name: "Saved", note: "server" });

		expect(yield* shownValues()).toEqual({ name: "Saved", note: "  local  " });
	},
);

entries.it(
	"after a rejected save, reverting restores the refresh that arrived during it",
	[
		entries.serverRejects("name", "Taken"),
		entries.edited("name", "Submitted"),
		entries.saveInFlight(),
		entries.refreshReceived({ name: "First", note: "Remote" }),
		entries.saveAnswered(),
	],
	function* ({ revert, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "Submitted", note: "Remote" });

		yield* revert();

		expect(yield* shownValues()).toEqual({ name: "First", note: "Remote" });
	},
);
