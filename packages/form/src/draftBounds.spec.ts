import { expect } from "@effect/vitest";
import { draftNames } from "#test/drafts.ts";

const defaultMaxBytes = 256 * 1024;
const minute = 60 * 1000;
const sevenDays = 7 * 24 * 60 * minute;

draftNames.it(
	"stores a draft of up to 256 KiB by default and drops one that grows past it",
	[draftNames.persisted()],
	({ form, saved, storedDraftBytes }) => {
		form.change("name", "a");
		const overhead = storedDraftBytes() - 1;
		form.change("name", "a".repeat(defaultMaxBytes - overhead));
		expect(storedDraftBytes()).toBe(defaultMaxBytes);
		form.change("name", "a".repeat(defaultMaxBytes - overhead + 1));
		expect(saved.size).toBe(0);
		expect(form.values.value.name).toHaveLength(defaultMaxBytes - overhead + 1);
	},
);

draftNames.it(
	"restores a stored record of 256 KiB and drops a larger one on read",
	[draftNames.persisted()],
	({ form, reload, saved, storedDraftPaddedTo }) => {
		form.change("name", "Local");
		storedDraftPaddedTo(defaultMaxBytes);
		expect(reload({ name: "First" }).values.value).toEqual({ name: "Local" });
		storedDraftPaddedTo(defaultMaxBytes + 1);
		expect(reload({ name: "First" }).values.value).toEqual({ name: "First" });
		expect(saved.size).toBe(0);
	},
);

draftNames.it("restores a draft written within seven days", [draftNames.persisted()], ({ form, reload, storedDraftAgesBy }) => {
	form.change("name", "Local");
	storedDraftAgesBy(sevenDays - minute);
	expect(reload({ name: "First" }).values.value).toEqual({ name: "Local" });
});

draftNames.it("drops a draft last written more than seven days ago", [draftNames.persisted()], ({ form, reload, saved, storedDraftAgesBy }) => {
	form.change("name", "Local");
	storedDraftAgesBy(sevenDays + minute);
	expect(reload({ name: "First" }).values.value).toEqual({ name: "First" });
	expect(saved.size).toBe(0);
});
