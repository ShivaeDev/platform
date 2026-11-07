import { expect, it } from "vitest";
import { contract } from "#contract.ts";
import { Create, Get, NoteMissing, Rename } from "#test/notes.ts";
import { operationsFor } from "#test/operationsFor.ts";

it("reuses declared rejection classes", () => {
	expect(Get.Rejection.NoteMissing).toBe(NoteMissing);
	expect(Rename.Rejection.NoteMissing).toBe(NoteMissing);
});

it("generates a distinct rejection class for each operation's field spec", () => {
	expect(Create.Rejection.Invalid).not.toBe(Rename.Rejection.Invalid);
});

for (const kind of ["query", "command", "stream"] as const) {
	for (const name of ["get", "$Changes", "$changesExtra"]) {
		it(`declaring a ${kind} named ${name} keeps its RPC alongside the built-in changes stream`, () => {
			const declared = contract("notes", operationsFor(kind, name));

			expect([...declared.application.requests.keys()]).toEqual([`notes.${name}`]);
			expect([...declared.requests.keys()]).toEqual([`notes.${name}`, "notes.$changes"]);
		});
	}
}
