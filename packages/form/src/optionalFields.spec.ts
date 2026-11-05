import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { optionalFields, profileRemoved } from "#test/optionalFields.ts";

optionalFields.it(
	"an omitted group ref reads absent while a nullable group reads null",
	[optionalFields.edited("profile", { name: "Ada", surname: "Lovelace" })],
	function* ({ groupRead, omit }) {
		yield* omit("profile");

		expect(yield* groupRead()).toStrictEqual({ nullable: null, profile: undefined });
	},
);

optionalFields.it(
	"recreating an omitted group submits all its required siblings",
	[optionalFields.edited("profile", { name: "Ada", surname: "Lovelace" }), profileRemoved()],
	function* ({ enter, savedValue, submit }) {
		yield* enter("profile", { name: "Grace", surname: "Hopper" });
		yield* submit();

		expect((yield* savedValue()).profile).toStrictEqual({ name: "Grace", surname: "Hopper" });
	},
);

optionalFields.it(
	"omitting a nested note retains its required siblings",
	[optionalFields.edited("group", { name: "Ada", note: "Local", surname: "Lovelace" })],
	function* ({ omitGroupNote, shown }) {
		yield* omitGroupNote();

		expect(yield* shown("group")).toStrictEqual({ name: "Ada", surname: "Lovelace" });
	},
);

optionalFields.it(
	"assigning undefined to an optional string is dirty and fails submission",
	[],
	function* ({ enter, keyPresent, saveOutcome, submit, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(false);

		yield* enter("note", undefined);
		yield* submit();

		yield* outcomes([
			["unsaved input", () => unsavedChanges(), true],
			["submission", () => saveOutcome(), "invalid"],
			["note key", () => keyPresent("note"), true],
		]);
	},
);

optionalFields.it(
	"omitting a present undefined key makes it absent and saves cleanly",
	[optionalFields.edited("note", undefined)],
	function* ({ omit, savedKeyPresent, submit, unsavedChanges }) {
		expect(yield* unsavedChanges()).toBe(true);

		yield* omit("note");
		yield* submit();

		yield* outcomes([
			["submitted note key", () => savedKeyPresent("note"), false],
			["unsaved input", () => unsavedChanges(), false],
		]);
	},
);

optionalFields.it(
	"explicit undefined remains a present value when the schema allows it",
	[],
	function* ({ enter, savedKeyPresent, submit, unsavedChanges }) {
		yield* enter("explicit", undefined);
		expect(yield* unsavedChanges()).toBe(true);
		yield* submit();

		yield* outcomes([
			["submitted undefined key", () => savedKeyPresent("explicit"), true],
			["unsaved input", () => unsavedChanges(), false],
		]);
	},
);

optionalFields.it(
	"a refresh keeps an invalid present undefined edit and revert removes it",
	[optionalFields.edited("note", undefined)],
	function* ({ keyPresent, refresh, revert, unsavedChanges }) {
		yield* refresh({ group: { name: "Grace", surname: "Hopper" }, nullable: null });

		yield* outcomes([
			["note key after receive", () => keyPresent("note"), true],
			["unsaved input after receive", () => unsavedChanges(), true],
		]);

		yield* revert();

		yield* outcomes([
			["note key after revert", () => keyPresent("note"), false],
			["unsaved input after revert", () => unsavedChanges(), false],
		]);
	},
);

optionalFields.it(
	"omitting a permitted undefined value during save remains an unsaved omission",
	[optionalFields.startsWith({ explicit: undefined, group: { name: "Ada", surname: "Lovelace" }, nullable: null }), optionalFields.saveInFlight()],
	function* ({ finishSave, keyPresent, omit, unsavedChanges }) {
		yield* omit("explicit");
		yield* finishSave();

		yield* outcomes([
			["undefined key", () => keyPresent("explicit"), false],
			["unsaved input", () => unsavedChanges(), true],
		]);
	},
);
