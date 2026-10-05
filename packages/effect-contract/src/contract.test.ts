import { describe, expect } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { contract } from "#contract.ts";
import { type CommandShape, command, type QueryShape } from "#operation.ts";
import { Create, Get, List, makeServer, NoteMissing, Notes, Rename } from "#test/notes.ts";

describe("contract", () => {
	it("rejects duplicate operation names at construction when the compiler cannot see them", () => {
		const queries: readonly QueryShape[] = [List, Get, List];
		expect(() => contract("dupes", { queries })).toThrow("Operation names must be unique; duplicated: list");
		const commands: readonly CommandShape[] = [command("get", { invalidates: () => [] })];
		expect(() => contract("dupes", { commands, queries: [Get] })).toThrow("Operation names must be unique; duplicated: get");
	});

	it.effect("reuses declared rejection classes and generates classes for field specs", function* () {
		expect(Get.Rejection.NoteMissing).toBe(NoteMissing);
		expect(Rename.Rejection.NoteMissing).toBe(NoteMissing);
		const invalid = yield* Effect.flip(Rename.reject.Invalid({ field: "title", message: "Enter a title" }));
		expect(invalid).toBeInstanceOf(Rename.Rejection.Invalid);
		expect(invalid).toMatchObject({ _tag: "Invalid", field: "title", message: "Enter a title" });
		expect(Create.Rejection.Invalid).not.toBe(Rename.Rejection.Invalid);
	});

	it.effect("round-trips successes and declared rejections through the native client and handlers", () =>
		Effect.gen(function* () {
			const server = yield* makeServer;
			const client = yield* RpcTest.makeClient(Notes, { flatten: true }).pipe(Effect.provide(server.layer));
			expect(yield* client("notes.get", { id: 1 })).toMatchObject({ id: 1, title: "One" });
			const missing = yield* Effect.flip(client("notes.get", { id: 9 }));
			expect(missing).toBeInstanceOf(NoteMissing);
			const invalid = yield* Effect.flip(client("notes.rename", { id: 1, title: " " }));
			expect(invalid).toMatchObject({ _tag: "Invalid", field: "title" });
			const created = yield* client("notes.create", { body: "b", title: "Three" });
			expect(created).toMatchObject({ id: 3, title: "Three" });
			expect((yield* client("notes.list", undefined)).map((note) => note.title)).toEqual(["One", "Two", "Three"]);
			yield* Ref.set(server.denied, true);
			expect(yield* Effect.flip(client("notes.list", undefined))).toMatchObject({ _tag: "Denied" });
		}).pipe(Effect.scoped),
	);

	it.effect("serves a contract without middleware through toLayer", () =>
		Effect.gen(function* () {
			const Plain = contract("plain", { queries: [List] });
			const layer = Plain.toLayer(Effect.succeed(Plain.of({ "plain.list": () => Effect.succeed([]) })));
			const client = yield* RpcTest.makeClient(Plain, { flatten: true }).pipe(Effect.provide(layer));
			expect(yield* client("plain.list", undefined)).toEqual([]);
		}).pipe(Effect.scoped),
	);
});
