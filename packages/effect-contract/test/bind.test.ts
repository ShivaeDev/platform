import { Effect, Ref, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcTest } from "effect/unstable/rpc";
import { expect, it, vi } from "vitest";
import { bind } from "#bind.ts";
import { makeServer, Notes } from "./notes.ts";

const setup = async () => {
	const server = await Effect.runPromise(makeServer);
	class NotesClient extends AtomRpc.Service<NotesClient>()("test/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: server.layer,
	}) {}
	const api = bind(Notes, NotesClient);
	const registry = AtomRegistry.make();
	const run = <A, E>(effect: Effect.Effect<A, E, NotesClient | Reactivity.Reactivity>) =>
		Effect.runPromise(Effect.result(AtomRegistry.getResult(registry, NotesClient.runtime.atom(effect))));
	const reads = () => Effect.runSync(Ref.get(server.reads));
	return { api, reads, registry, run, server };
};

it("queries register their declared read keys and commands invalidate item and list after success only", async () => {
	const { api, registry, run, reads } = await setup();
	const one = api.get.query({ id: 1 });
	const two = api.get.query({ id: 2 });
	const list = api.list.query(undefined);
	const unmount = [registry.mount(one), registry.mount(two), registry.mount(list)];
	try {
		await vi.waitFor(() => expect([...reads()].sort()).toEqual(["get:1", "get:2", "list"]));
		const renamed = await run(api.rename.run({ id: 1, title: "Uno" }));
		expect(Result.isSuccess(renamed)).toBe(true);
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.title).toBe("Uno"));
		await vi.waitFor(() => expect(reads().filter((read) => read === "list")).toHaveLength(2));
		expect(reads().filter((read) => read === "get:2")).toHaveLength(1);
		const rejected = await run(api.rename.run({ id: 2, title: "" }));
		expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Invalid");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(reads().filter((read) => read === "list")).toHaveLength(2);
		expect(reads().filter((read) => read === "get:2")).toHaveLength(1);
	} finally {
		for (const release of unmount) {
			release();
		}
		registry.dispose();
	}
});

it("result-dependent invalidation refreshes the item a command created", async () => {
	const { api, registry, run, reads } = await setup();
	const three = api.get.query({ id: 3 });
	const release = registry.mount(three);
	try {
		await vi.waitFor(() => expect(AsyncResult.isFailure(registry.get(three))).toBe(true));
		expect(Result.isSuccess(await run(api.create.run({ body: "", title: "Three" })))).toBe(true);
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(three), () => undefined)?.title).toBe("Three"));
		expect(reads().filter((read) => read === "get:3")).toHaveLength(2);
	} finally {
		release();
		registry.dispose();
	}
});

it("query run performs a one-off typed call without registering keys", async () => {
	const { api, registry, run } = await setup();
	try {
		const found = await run(api.get.run({ id: 2 }));
		expect(Result.isSuccess(found) && found.success.title).toBe("Two");
		const missing = await run(api.get.run({ id: 7 }));
		expect(Result.isFailure(missing) && missing.failure._tag).toBe("NoteMissing");
	} finally {
		registry.dispose();
	}
});
