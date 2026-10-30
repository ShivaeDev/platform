import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { configurations, configuredForm, draftTypedThenReconfigured, rejectedSaveWaiting } from "#test/configurationStories.tsx";

for (const kind of ["create", "editor"] as const) {
	function initial(revision: string) {
		return kind === "create" ? revision : `${revision}:stored`;
	}

	configurations.it(
		`a ${kind} form rerendered with new inline callbacks keeps its form and draft`,
		[configuredForm({ kind })],
		function* ({ form, input, reconfigure, type }) {
			yield* type("draft");

			yield* reconfigure("inline callbacks");

			yield* outcomes({
				draft: [input(), "draft"],
				form: [form(), "original form"],
			});
		},
	);

	configurations.it(
		`a ${kind} form saves through the inline save callback it last rendered`,
		[draftTypedThenReconfigured(kind, "inline callbacks")],
		function* ({ save, savedWith }) {
			yield* save();

			expect(yield* savedWith()).toEqual(["after:first:draft"]);
		},
	);

	for (const [change, error] of [
		[undefined, "before"],
		["inline callbacks", "after"],
		["removing the rejection mapper", "automatic"],
	] as const) {
		configurations.it(
			`a ${kind} form ${change ? `rerendered with ${change} changed ` : ""}maps a rejected save to "${error}"`,
			[configuredForm({ kind, rejected: true })],
			function* ({ fieldError, reconfigure, save }) {
				if (change) {
					yield* reconfigure(change);
				}

				yield* save();

				expect(yield* fieldError()).toBe(error);
			},
		);
	}

	configurations.it(
		`a ${kind} form maps a rejection that arrives after a mapper change with the new mapper`,
		[rejectedSaveWaiting(kind)],
		function* ({ fieldError, finishSave, reconfigure }) {
			yield* reconfigure("inline callbacks");

			yield* finishSave();

			expect(yield* fieldError()).toBe("after");
		},
	);

	configurations.it(
		`a ${kind} form reverts to the initial values it converted when it was created`,
		[draftTypedThenReconfigured(kind, "inline callbacks")],
		function* ({ input, revert }) {
			yield* revert();

			expect(yield* input()).toBe(initial("before"));
		},
	);

	configurations.it(
		`a ${kind} form keeps persisting under the draft key it was created with`,
		[configuredForm({ kind })],
		function* ({ reconfigure, storedDraft, type }) {
			yield* reconfigure("inline callbacks");

			yield* type("draft");

			yield* outcomes({
				"created key": [storedDraft("before"), "draft"],
				"rendered key": [storedDraft("after"), "none"],
			});
		},
	);

	configurations.it(
		`a ${kind} form replaced by a schema change persists under its new draft key`,
		[draftTypedThenReconfigured(kind, "the schema")],
		function* ({ storedDraft, type }) {
			yield* type("new draft");

			expect(yield* storedDraft("after")).toBe("new draft");
		},
	);

	for (const [change, typed, saved] of [
		["the schema", " draft ", "after:first:draft"],
		["the runtime", "draft", "after:second:draft"],
	] as const) {
		configurations.it(
			`a ${kind} form rerendered with ${change} changed starts over from new initial values`,
			[configuredForm({ kind })],
			function* ({ form, input, reconfigure, type }) {
				yield* type("discarded");

				yield* reconfigure(change);

				yield* outcomes({
					draft: [input(), initial("after")],
					form: [form(), "replaced form"],
				});
			},
		);

		configurations.it(
			`a ${kind} form replaced by a change to ${change} saves with it`,
			[draftTypedThenReconfigured(kind, change, "discarded")],
			function* ({ save, savedWith, type }) {
				yield* type(typed);

				yield* save();

				expect(yield* savedWith()).toEqual([saved]);
			},
		);
	}
}
