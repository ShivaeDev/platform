import { Schema } from "effect";
import { expect, it } from "vitest";
import { contract } from "#contract.ts";
import { type CommandShape, command, type QueryShape, type StreamShape, stream } from "#operation.ts";
import { Create, Get, List, NoteMissing, Rename } from "#test/notes.ts";
import { operationsFor } from "#test/operationsFor.ts";

it("rejects duplicate operation names at construction when the compiler cannot see them", () => {
	const queries: readonly QueryShape[] = [List, Get, List];
	expect(() => contract("dupes", { queries })).toThrow("Operation names must be unique; duplicated: list");
	const commands: readonly CommandShape[] = [command("get", { invalidates: () => [] })];
	expect(() => contract("dupes", { commands, queries: [Get] })).toThrow("Operation names must be unique; duplicated: get");
	const streams: readonly StreamShape[] = [stream("get", { reads: () => [], success: Schema.String })];
	expect(() => contract("dupes", { queries: [Get], streams })).toThrow("Operation names must be unique; duplicated: get");
	expect(() => contract("dupes", { streams: [...streams, ...streams] })).toThrow("Operation names must be unique; duplicated: get");
});

it("reuses declared rejection classes", () => {
	expect(Get.Rejection.NoteMissing).toBe(NoteMissing);
	expect(Rename.Rejection.NoteMissing).toBe(NoteMissing);
});

it("generates a distinct rejection class for each operation's field spec", () => {
	expect(Create.Rejection.Invalid).not.toBe(Rename.Rejection.Invalid);
});

for (const kind of ["query", "command", "stream"] as const) {
	it(`declaring a ${kind} named $changes fails with a reserved-name declaration error`, () => {
		expect(() => contract("notes", operationsFor(kind, "$changes"))).toThrow(
			"Operation name $changes is reserved for the built-in changes stream on contract notes",
		);
	});

	for (const name of ["get", "$Changes", "$changesExtra"]) {
		it(`declaring a ${kind} named ${name} keeps its RPC alongside the built-in changes stream`, () => {
			const declared = contract("notes", operationsFor(kind, name));

			expect([...declared.application.requests.keys()]).toEqual([`notes.${name}`]);
			expect([...declared.requests.keys()]).toEqual([`notes.${name}`, "notes.$changes"]);
		});
	}
}
