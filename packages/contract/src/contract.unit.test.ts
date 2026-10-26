import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/test/it.ts";
import { contract } from "#contract.ts";
import { type CommandShape, command, type QueryShape, type StreamShape, stream } from "#operation.ts";
import { Create, Get, List, NoteMissing, Rename } from "#test/notes.ts";

it("rejects duplicate operation names at construction when the compiler cannot see them", () => {
	const queries: readonly QueryShape[] = [List, Get, List];
	expect(() => contract("dupes", { queries })).toThrow("Operation names must be unique; duplicated: list");
	const commands: readonly CommandShape[] = [command("get", { invalidates: () => [] })];
	expect(() => contract("dupes", { commands, queries: [Get] })).toThrow("Operation names must be unique; duplicated: get");
	const streams: readonly StreamShape[] = [stream("get", { reads: () => [], success: Schema.String })];
	expect(() => contract("dupes", { queries: [Get], streams })).toThrow("Operation names must be unique; duplicated: get");
	expect(() => contract("dupes", { streams: [...streams, ...streams] })).toThrow("Operation names must be unique; duplicated: get");
});

it.effect("reuses declared rejection classes and generates classes for field specs", function* () {
	expect(Get.Rejection.NoteMissing).toBe(NoteMissing);
	expect(Rename.Rejection.NoteMissing).toBe(NoteMissing);
	const invalid = yield* Effect.flip(Rename.reject.Invalid({ field: "title", message: "Enter a title" }));
	expect(invalid).toBeInstanceOf(Rename.Rejection.Invalid);
	expect(invalid).toMatchObject({ _tag: "Invalid", field: "title", message: "Enter a title" });
	expect(Create.Rejection.Invalid).not.toBe(Rename.Rejection.Invalid);
});
