import { Deferred, Effect, Option, Ref } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, expect, it, vi } from "vitest";
import { liveClient } from "#test/live/client.ts";
import { liveServer } from "#test/live/server.ts";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});
async function setup() {
	const server = await liveServer();
	cleanups.push(server.close);
	const client = liveClient(server.url);
	const registry = AtomRegistry.make();
	cleanups.push(() => registry.dispose());
	const one = client.api.get.query({ id: "one" });
	const two = client.api.get.query({ id: "two" });
	const list = client.api.list.query();
	cleanups.push(registry.mount(client.connection));
	await vi.waitFor(() => expect(registry.get(client.status).connection).toBe("live"));
	for (const atom of [one, two]) {
		cleanups.push(registry.mount(atom));
	}
	cleanups.push(registry.mount(list));
	function body(atom: typeof one) {
		return AsyncResult.getOrElse(registry.get(atom), () => undefined)?.body;
	}
	await vi.waitFor(() => expect(body(one)).toBe("First"));
	return { ...server, ...client, body, list, one, registry, two };
}
it("refreshes affected item/list over native streaming HTTP while preserving the unrelated query", async () => {
	const test = await setup();
	await vi.waitFor(() => expect(test.body(test.two)).toBe("Second"));
	const before = Effect.runSync(Ref.get(test.reads)).filter((id) => id === "two").length;
	await test.edit("one", "Changed");
	await vi.waitFor(() => expect(test.body(test.one)).toBe("Changed"));
	await vi.waitFor(() => expect(AsyncResult.getOrElse(test.registry.get(test.list), () => []).find(({ id }) => id === "one")?.body).toBe("Changed"));
	expect(Effect.runSync(Ref.get(test.reads)).filter((id) => id === "two")).toHaveLength(before);
});
it("bounds paused hints and resyncs current source once resumed", async () => {
	const test = await setup();
	test.registry.set(test.paused, true);
	await test.edit("one", "While paused");
	for (let index = 0; index < 300; index += 1) {
		await test.emit({ _tag: "Resync" });
	}
	await vi.waitFor(() => expect(test.registry.get(test.status).pending).toBe(256));
	expect(test.body(test.one)).toBe("First");
	test.registry.set(test.paused, false);
	await vi.waitFor(() => expect(test.body(test.one)).toBe("While paused"));
	expect(test.registry.get(test.status).pending).toBe(0);
});
it("retains successful data on typed read failure and reconciles on resume", async () => {
	const test = await setup();
	Effect.runSync(Ref.set(test.unavailable, true));
	await test.edit("one", "After outage");
	await vi.waitFor(() => expect(AsyncResult.isFailure(test.registry.get(test.one))).toBe(true));
	expect(test.body(test.one)).toBe("First");
	Effect.runSync(Ref.set(test.unavailable, false));
	test.registry.set(test.resume, 1);
	await vi.waitFor(() => expect(test.body(test.one)).toBe("After outage"));
});
it("resyncs missed source changes after a typed stream outage without duplicating subscriptions", async () => {
	const test = await setup();
	Effect.runSync(Ref.set(test.streamUnavailable, true));
	await test.disconnect();
	await vi.waitFor(() => expect(Option.isSome(test.registry.get(test.status).failure)).toBe(true));
	expect(test.registry.get(test.status).needsResync).toBe(true);
	expect(test.body(test.one)).toBe("First");
	await test.edit("one", "Missed while disconnected");
	Effect.runSync(Ref.set(test.streamUnavailable, false));
	await vi.waitFor(() => expect(test.body(test.one)).toBe("Missed while disconnected"));
	expect(test.registry.get(test.status).connection).toBe("live");
	expect(Option.isNone(test.registry.get(test.status).failure)).toBe(true);
	expect(Effect.runSync(Ref.get(test.active))).toBe(1);
});
it("interrupts stale HTTP reads on invalidation and disposes the single stream subscription", async () => {
	const test = await setup();
	const gate = Effect.runSync(Deferred.make<void>());
	Effect.runSync(Ref.set(test.gate, Deferred.await(gate)));
	const before = Effect.runSync(Ref.get(test.reads)).length;
	await test.edit("one", "Older request");
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.reads)).length).toBeGreaterThan(before));
	Effect.runSync(Ref.set(test.gate, Effect.void));
	await test.edit("one", "Newest request");
	await vi.waitFor(() => expect(test.body(test.one)).toBe("Newest request"));
	Effect.runSync(Deferred.succeed(gate, undefined));
	await test.emit({ _tag: "Resync" });
	await vi.waitFor(() => expect(test.registry.get(test.one).waiting).toBe(false));
	expect(test.body(test.one)).toBe("Newest request");
	expect(Effect.runSync(Ref.get(test.connections))).toBe(1);
	test.registry.dispose();
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.active))).toBe(0));
});
