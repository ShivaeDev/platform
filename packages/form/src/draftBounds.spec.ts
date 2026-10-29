import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { draftNames, storedDraftPaddedTo, storedDraftWrittenAgo } from "#test/draftBounds.ts";

const defaultMaxBytes = 256 * 1024;
const minute = 60 * 1000;
const sevenDays = 7 * 24 * 60 * minute;
const localDraft = [draftNames.draftsStored(), draftNames.edited("name", "Local")];

draftNames.it(
	"a draft that fills the 256 KiB default exactly is stored",
	[draftNames.draftsStored()],
	function* ({ enterNameStoredAs, storedDraftBytes }) {
		yield* enterNameStoredAs(defaultMaxBytes);

		expect(yield* storedDraftBytes()).toBe(defaultMaxBytes);
	},
);

draftNames.it(
	"a draft one byte past the 256 KiB default is not stored, and the name stays in the form",
	[draftNames.draftsStored()],
	function* ({ enterNameStoredAs, shown, storedDraft }) {
		const name = yield* enterNameStoredAs(defaultMaxBytes + 1);

		yield* outcomes({
			"shown name": [shown("name"), name],
			"stored draft": [storedDraft(), undefined],
		});
	},
);

draftNames.it(
	"reopening restores a stored draft of exactly 256 KiB",
	[...localDraft, storedDraftPaddedTo(defaultMaxBytes)],
	function* ({ reopen, shown, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ name: "Local" });

		yield* reopen({ name: "First" });

		expect(yield* shown("name")).toBe("Local");
	},
);

draftNames.it(
	"reopening drops a stored draft one byte past 256 KiB",
	[...localDraft, storedDraftPaddedTo(defaultMaxBytes + 1)],
	function* ({ reopen, shown, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ name: "Local" });

		yield* reopen({ name: "First" });

		yield* outcomes({
			"shown name": [shown("name"), "First"],
			"stored draft": [storedDraft(), undefined],
		});
	},
);

draftNames.it(
	"reopening restores a draft written a minute short of seven days ago",
	[...localDraft, storedDraftWrittenAgo("a minute short of seven days", sevenDays - minute)],
	function* ({ reopen, shown, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ name: "Local" });

		yield* reopen({ name: "First" });

		expect(yield* shown("name")).toBe("Local");
	},
);

draftNames.it(
	"reopening drops a draft written a minute more than seven days ago",
	[...localDraft, storedDraftWrittenAgo("a minute more than seven days", sevenDays + minute)],
	function* ({ reopen, shown, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ name: "Local" });

		yield* reopen({ name: "First" });

		yield* outcomes({
			"shown name": [shown("name"), "First"],
			"stored draft": [storedDraft(), undefined],
		});
	},
);
