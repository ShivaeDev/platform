import { expect } from "@effect/vitest";
import { entries, names } from "#test/lifecycle.ts";

names.it("a successful save establishes the submitted baseline", [], function* ({ form, submit, result, dirty }) {
	form.change("name", "  Saved  ");
	submit();
	expect(yield* result()).toEqual({ name: "Saved" });
	expect(form.values.value).toEqual({ name: "  Saved  " });
	expect(dirty()).toBe(false);
	form.change("name", "First");
	expect(dirty()).toBe(true);
});

names.it("a rejected save keeps the draft dirty", [names.rejects("name", "Already used")], function* ({ form, submit, reject, dirty }) {
	form.change("name", "Taken");
	submit();
	expect(yield* reject()).toMatchObject({ message: "Already used" });
	expect(form.values.value).toEqual({ name: "Taken" });
	expect(dirty()).toBe(true);
});

names.it(
	"edits made during a save remain dirty after it succeeds",
	[names.delayed()],
	function* ({ form, submit, result, waitForSave, finishSave, dirty }) {
		form.change("name", "Submitted");
		submit();
		yield* waitForSave();
		form.change("name", "Still editing");
		yield* finishSave();
		expect(yield* result()).toEqual({ name: "Submitted" });
		expect(form.values.value).toEqual({ name: "Still editing" });
		expect(dirty()).toBe(true);
		form.change("name", "Submitted");
		expect(dirty()).toBe(false);
	},
);

names.it(
	"a late field rejection does not attach to a newer edit",
	[names.rejects("name", "Submitted name is taken"), names.delayed()],
	function* ({ form, submit, reject, waitForSave, finishSave, errors }) {
		form.change("name", "Submitted");
		submit();
		yield* waitForSave();
		form.change("name", "Newer");
		yield* finishSave();
		yield* reject();
		expect(errors("name")).toBeUndefined();
		expect(form.values.value.name).toBe("Newer");
	},
);

names.it(
	"a refresh received during a save stays the baseline after it succeeds",
	[names.delayed()],
	function* ({ form, submit, result, waitForSave, finishSave, dirty }) {
		form.change("name", "  Saved  ");
		submit();
		yield* waitForSave();
		form.receive({ name: "Saved" });
		yield* finishSave();
		yield* result();
		expect(form.values.value).toEqual({ name: "  Saved  " });
		expect(dirty()).toBe(false);
		form.revert();
		expect(form.values.value).toEqual({ name: "Saved" });
	},
);

names.it(
	"edits made after submission stay dirty against a refresh received during the save",
	[names.delayed()],
	function* ({ form, submit, result, waitForSave, finishSave, dirty }) {
		form.change("name", "Submitted");
		submit();
		yield* waitForSave();
		form.receive({ name: "Remote" });
		form.change("name", "Newer");
		yield* finishSave();
		yield* result();
		expect(form.values.value).toEqual({ name: "Newer" });
		expect(dirty()).toBe(true);
		form.change("name", "Remote");
		expect(dirty()).toBe(false);
	},
);

names.it(
	"a stale refresh during a save does not replace the submitted value",
	[names.delayed()],
	function* ({ form, submit, result, waitForSave, finishSave, dirty }) {
		form.change("name", "Submitted");
		submit();
		yield* waitForSave();
		form.receive({ name: "First" });
		yield* finishSave();
		yield* result();
		expect(form.values.value).toEqual({ name: "Submitted" });
		expect(dirty()).toBe(false);
		form.receive({ name: "Submitted by server" });
		expect(form.values.value).toEqual({ name: "Submitted by server" });
		expect(dirty()).toBe(false);
	},
);

entries.it("a normalized server value lands in a clean field but not in a dirty one", [], function* ({ form, submit, result, dirty }) {
	form.change("name", "  Saved  ");
	submit();
	yield* result();
	form.change("note", "  local  ");
	form.receive({ name: "Saved", note: "server" });
	expect(form.values.value).toEqual({ name: "Saved", note: "  local  " });
	expect(dirty()).toBe(true);
});

entries.it(
	"a failed save leaves a refresh received during it as the baseline",
	[entries.rejects("name", "Taken"), entries.delayed()],
	function* ({ form, submit, reject, waitForSave, finishSave, dirty }) {
		form.change("name", "Submitted");
		submit();
		yield* waitForSave();
		form.receive({ name: "First", note: "Remote" });
		yield* finishSave();
		yield* reject();
		expect(form.values.value).toEqual({ name: "Submitted", note: "Remote" });
		expect(dirty()).toBe(true);
		form.revert();
		expect(form.values.value).toEqual({ name: "First", note: "Remote" });
	},
);

names.it(
	"a resubmission after a refresh accepts only the latest submitted values",
	[names.delayed()],
	function* ({ form, submit, result, waitForSave, dirty }) {
		form.change("name", "One");
		submit();
		yield* waitForSave();
		form.receive({ name: "Remote" });
		form.change("name", "Two");
		submit();
		expect(yield* result()).toEqual({ name: "Two" });
		expect(dirty()).toBe(false);
		form.change("name", "Remote");
		expect(dirty()).toBe(true);
	},
);
