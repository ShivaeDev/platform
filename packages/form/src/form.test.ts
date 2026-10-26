import { expect } from "@effect/vitest";
import { Invalid } from "#shape.ts";
import { asyncName, choices, nestedProp, plainName, profiles, prototype, requiredName, slugs, takenName, visibility } from "#test/forms.ts";

requiredName.it("invalid submission reveals field errors and never calls the handler", [], function* ({ submit, reject, errors, submissions }) {
	expect(errors("name")).toBeUndefined();
	submit();
	expect(yield* reject()).toBeInstanceOf(Invalid);
	expect(submissions.length).toBe(0);
	expect(errors("name")).toBe("Required");
});

takenName.it(
	"changing a field clears its server rejection and a retry submits the new value",
	[],
	function* ({ form, submit, result, reject, errors }) {
		errors("name");
		submit();
		yield* reject();
		expect(errors("name")).toBe("Already used");
		form.change("name", "available");
		expect(errors("name")).toBeUndefined();
		submit();
		expect(yield* result()).toBe("available");
	},
);

visibility.it("derives literal choices from the field schema", [], ({ form }) => {
	expect(form.choices("visibility")).toEqual(["private", "public"]);
});

choices.it("offers encoded literals when the field transforms them", [], ({ form }) => {
	expect(form.choices("choice")).toEqual(["yes", "no"]);
});

prototype.it("prototype-named fields have ordinary choices and validation messages", [], function* ({ form, submit, reject, errors }) {
	expect(form.choices("toString")).toBeUndefined();
	expect(errors("toString")).toBeUndefined();
	submit();
	yield* reject();
	expect(errors("toString")).toBe("Required");
});

slugs.it(
	"a submit handler reads runtime services and reports a domain failure on its field",
	[],
	function* ({ form, submit, reject, result, errors }) {
		errors("slug");
		errors("title");
		submit();
		yield* reject();
		expect(errors("slug")).toBe(`"root" is already in use`);
		expect(errors("title")).toBeUndefined();
		form.change("slug", "staging");
		submit();
		expect(yield* result()).toBe("staging");
	},
);

plainName.it("dirty clears when an edit is undone", [], ({ form, dirty }) => {
	form.change("name", "Ops");
	expect(dirty()).toBe(true);
	form.change("name", "");
	expect(dirty()).toBe(false);
});

asyncName.it(
	"a touched field has no schema message while its first async decode is pending",
	[],
	function* ({ form, errors, waitForSave, finishSave, eventually }) {
		form.blur("name");
		errors("name");
		yield* waitForSave();
		expect(errors("name")).toBeUndefined();
		yield* finishSave();
		yield* eventually(() => expect(errors("name")).toBe("Required"));
	},
);

profiles.it("field maps and updates follow the latest received values", [], ({ form, dirty }) => {
	const profile = form.field("profile");
	const label = profile.map((value) => value.label);
	form.receive({ profile: { count: 5, label: "Received" } });
	expect(label.value).toBe("Received");
	profile.update((value) => ({ ...value, count: value.count + 1 }));
	expect(form.values.value).toEqual({ profile: { count: 6, label: "Received" } });
	expect(label.value).toBe("Received");
	expect(dirty()).toBe(true);
	form.revert();
	expect(label.value).toBe("Received");
	expect(dirty()).toBe(false);
});

nestedProp.it.fails("BUG: a nested field prop should update the draft without recursive ref creation", [], ({ form }) => {
	const count = form.field("profile").prop("count");
	expect(count.value).toBe(1);
	count.set(2);
	expect(form.values.value).toEqual({ profile: { count: 2 } });
});
