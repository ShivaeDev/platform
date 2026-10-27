import { expect } from "vitest";
import { configurations, configuredForm } from "#test/configurationStories.tsx";

for (const kind of ["create", "editor"] as const) {
	configurations.it(
		`${kind} uses the latest inline save without replacing the draft`,
		[configuredForm(kind)],
		function* ({ form, type, reconfigure, input, submit, saved }) {
			const original = form();
			yield* type("draft");
			yield* reconfigure("callbacks");
			expect(form()).toBe(original);
			expect(input()).toBe("draft");
			yield* submit();
			expect(saved()).toEqual(["after:first:draft"]);
			yield* type("next");
			yield* submit();
			expect(saved()).toEqual(["after:first:draft", "after:first:next"]);
		},
	);

	configurations.it(`${kind} uses the latest rejection mapper`, [configuredForm(kind, true)], function* ({ reconfigure, submit, output }) {
		yield* reconfigure("callbacks");
		yield* submit();
		expect(output().error).toBe("after");
	});

	configurations.it(
		`${kind} maps a pending save failure with the latest mapper`,
		[configuredForm(kind, true, true)],
		function* ({ submit, reconfigure, finishSave, observe, output }) {
			yield* submit();
			yield* reconfigure("callbacks");
			yield* finishSave();
			yield* observe("the rejection uses the current mapper", () => expect(output().error).toBe("after"));
		},
	);

	configurations.it(
		`${kind} returns to automatic rejection mapping when the mapper is removed`,
		[configuredForm(kind, true)],
		function* ({ reconfigure, submit, output }) {
			yield* reconfigure("automatic");
			yield* submit();
			expect(output().error).toBe("automatic");
		},
	);

	configurations.it(
		`${kind} keeps its initial value conversion until the form is replaced`,
		[configuredForm(kind)],
		function* ({ type, reconfigure, revert, input }) {
			yield* type("draft");
			yield* reconfigure("callbacks");
			yield* revert();
			expect(input()).toBe(kind === "create" ? "before" : "before:stored");
		},
	);

	configurations.it(`${kind} captures persistence options for its form lifetime`, [configuredForm(kind)], function* ({ type, reconfigure }) {
		yield* reconfigure("callbacks");
		yield* type("draft");
		expect(window.localStorage.getItem(`${kind}-before`)).toContain("draft");
		expect(window.localStorage.getItem(`${kind}-after`)).toBeNull();
		yield* reconfigure("schema");
		yield* type("new draft");
		expect(window.localStorage.getItem(`${kind}-after`)).toContain("new draft");
	});

	configurations.it(
		`${kind} replaces the form and decodes with a changed schema`,
		[configuredForm(kind)],
		function* ({ form, type, reconfigure, input, submit, saved }) {
			const original = form();
			yield* type("discarded");
			yield* reconfigure("schema");
			expect(form()).not.toBe(original);
			expect(input()).toBe(kind === "create" ? "after" : "after:stored");
			yield* type(" draft ");
			yield* submit();
			expect(saved()).toEqual(["after:first:draft"]);
		},
	);

	configurations.it(
		`${kind} replaces the form and runs with a changed runtime`,
		[configuredForm(kind)],
		function* ({ form, type, reconfigure, input, submit, saved }) {
			const original = form();
			yield* type("discarded");
			yield* reconfigure("runtime");
			expect(form()).not.toBe(original);
			expect(input()).toBe(kind === "create" ? "after" : "after:stored");
			yield* type("draft");
			yield* submit();
			expect(saved()).toEqual(["after:second:draft"]);
		},
	);
}
