import { expect } from "vitest";
import { sharedDrafts } from "#test/sharedDrafts.ts";

sharedDrafts.it("a delayed initial read cannot replace a newer observed draft", [], function* ({ finishRead, holdRead, open, shown, type }) {
	yield* open("first");
	yield* type("first", "name", "Older answer");
	yield* holdRead();
	yield* open("second");
	yield* type("first", "name", "Newer answer");
	expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });

	yield* finishRead();

	expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });
});

sharedDrafts.it(
	"a submission that finishes before its draft write still clears that revision",
	[],
	function* ({ finishSave, finishWrite, holdWrite, open, shown, submit, type }) {
		yield* open("first");
		yield* holdWrite();
		yield* type("first", "name", "Submitted");
		yield* submit();
		yield* finishSave();

		yield* finishWrite();

		yield* open("second");
		expect(yield* shown("second")).toEqual({ name: "Paper", quantity: "300" });
	},
);

sharedDrafts.it("signing out drops the session's newer draft from the other editor", [], function* ({ open, shown, signOut, type }) {
	yield* open("first");
	yield* open("second");
	yield* type("first", "name", "First answer");
	yield* type("second", "name", "Newer answer");

	yield* signOut();

	yield* open("second");
	expect(yield* shown("second")).toEqual({ name: "Paper", quantity: "300" });
});

for (const laterLocalEdit of [false, true]) {
	sharedDrafts.it(
		`finishing an older save cannot rewrite newer shared fields${laterLocalEdit ? " after a later local edit" : ""}`,
		[],
		function* ({ finishSave, open, shown, submit, type }) {
			yield* open("first");
			yield* open("second");
			yield* type("first", "name", "Submitted");
			yield* submit();
			if (laterLocalEdit) {
				yield* type("first", "name", "Later local answer");
			}
			yield* type("second", "name", "Newer shared answer");
			yield* type("second", "quantity", "350");
			expect(yield* shown("second")).toEqual({ name: "Newer shared answer", quantity: "350" });

			yield* finishSave();

			yield* open("second");
			expect(yield* shown("second")).toEqual({ name: "Newer shared answer", quantity: "350" });
		},
	);
}
