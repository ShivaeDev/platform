import { Deferred, Effect, Result } from "effect";
import { expect } from "vitest";
import { Rejected } from "#test/postgres-example/contract.ts";
import { integration } from "#test/postgres-example/integration.ts";
import { makeClient } from "#test/postgres-example/makeClient.ts";
import { call, eventually } from "#test/postgres-example/view.tsx";

integration(
	"an authenticated PostgreSQL commit reaches another client's query and open editor over live HTTP",
	function* (harness) {
		const entered = yield* Deferred.make<void>();
		const released = yield* Deferred.make<void>();
		const server = yield* Effect.promise(() =>
			harness.start({ beforeCommit: Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(released)) }),
		);
		const writer = yield* Effect.promise(server.mount);
		const reader = yield* Effect.promise(server.mount);
		yield* Effect.promise(() =>
			eventually(() => {
				expect(writer.input("name").value).toBe("Printer paper");
				expect(reader.input("quantity").value).toBe("300");
				expect(reader.registry.get(reader.status).connection).toBe("live");
				expect(writer.registry.get(writer.status).connection).toBe("live");
				expect(server.reads).toHaveLength(4);
				expect(writer.registry.get(writer.query).waiting).toBe(false);
				expect(reader.registry.get(reader.query).waiting).toBe(false);
			}),
		);
		const deliveries = server.delivered.length;
		yield* Effect.promise(() => writer.edit("name", "  Office chairs  "));
		yield* Effect.promise(() => writer.edit("quantity", "450"));
		yield* Effect.promise(() => writer.click("Save"));
		yield* Deferred.await(entered);
		expect(yield* Effect.promise(server.read)).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(server.publications).toEqual([]);
		expect(server.delivered).toHaveLength(deliveries);
		expect(reader.container.querySelector("output")?.textContent).toBe("Printer paper / 300");
		yield* Deferred.succeed(released, undefined);
		yield* Effect.promise(() =>
			eventually(() => {
				expect(reader.container.querySelector("output")?.textContent).toBe("Office chairs / 450");
				expect(reader.input("name").value).toBe("Office chairs");
				expect(reader.input("quantity").value).toBe("450");
				expect(writer.container.querySelector('[role="status"]')?.textContent).toBe("Saved");
			}),
		);
		expect(yield* Effect.promise(server.read)).toEqual([{ name: "Office chairs", quantity: 450 }]);
		expect(server.publications).toEqual(["orders:1"]);
		expect(server.delivered.slice(deliveries)).toEqual([[{ name: "Office chairs", quantity: 450 }], [{ name: "Office chairs", quantity: 450 }]]);
		yield* Effect.promise(() => reader.edit("name", "Unsaved local name"));
		yield* Effect.promise(() => writer.edit("name", "Remote update"));
		yield* Effect.promise(() => writer.edit("quantity", "900"));
		yield* Effect.promise(() => writer.click("Save"));
		yield* Effect.promise(() =>
			eventually(() => {
				expect(reader.container.querySelector("output")?.textContent).toBe("Remote update / 900");
				expect(reader.input("name").value).toBe("Unsaved local name");
				expect(reader.input("quantity").value).toBe("900");
				expect(reader.container.querySelector('[role="status"]')?.textContent).toBe("Unsaved changes");
			}),
		);
		yield* Effect.promise(() => reader.click("Revert"));
		expect(reader.input("name").value).toBe("Remote update");
		for (const [token, tag] of [
			[undefined, "Unauthorized"],
			["bob-session", "Missing"],
		]) {
			const client = makeClient(server.url, token);
			const result = yield* Effect.promise(() => call(client, client.api.save.run({ id: 1, name: "Forbidden", quantity: 1 }).pipe(Effect.result)));
			expect(Result.isFailure(result) && result.failure._tag).toBe(tag);
		}
		expect(server.publications).toEqual(["orders:1", "orders:1"]);
		expect(yield* Effect.promise(server.read)).toEqual([{ name: "Remote update", quantity: 900 }]);
	},
	20_000,
);

integration(
	"a write recorded inside a rolled-back PostgreSQL transaction publishes no live hint",
	function* (harness) {
		const entered = yield* Deferred.make<void>();
		const released = yield* Deferred.make<void>();
		const server = yield* Effect.promise(() =>
			harness.start({
				beforeCommit: Effect.gen(function* () {
					yield* Deferred.succeed(entered, undefined);
					yield* Deferred.await(released);
					return yield* new Rejected();
				}),
			}),
		);
		const reader = yield* Effect.promise(server.mount);
		yield* Effect.promise(() =>
			eventually(() => {
				expect(reader.input("name").value).toBe("Printer paper");
				expect(reader.registry.get(reader.status).connection).toBe("live");
				expect(server.reads).toHaveLength(2);
				expect(reader.registry.get(reader.query).waiting).toBe(false);
			}),
		);
		const deliveries = server.delivered.length;
		const reads = server.reads.length;
		const client = makeClient(server.url, "alice-session");
		const response = call(client, client.api.save.run({ id: 1, name: "Rolled back", quantity: 999 }).pipe(Effect.result));
		yield* Deferred.await(entered);
		expect(yield* Effect.promise(server.read)).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(server.publications).toEqual([]);
		yield* Deferred.succeed(released, undefined);
		const result = yield* Effect.promise(() => response);
		expect(Result.isFailure(result) && result.failure._tag).toBe("Rejected");
		expect(yield* Effect.promise(server.read)).toEqual([{ name: "Printer paper", quantity: 300 }]);
		expect(server.publications).toEqual([]);
		expect(server.delivered).toHaveLength(deliveries);
		expect(server.reads).toHaveLength(reads);
		expect(reader.container.querySelector("output")?.textContent).toBe("Printer paper / 300");
		expect(reader.input("name").value).toBe("Printer paper");
	},
	20_000,
);
