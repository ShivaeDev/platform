import { Effect, Ref, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { expect, it, vi } from "vitest";
import { LiveHint } from "#live.ts";
import { liveClient } from "#test/live/client.ts";
import { documents } from "#test/live/contract.ts";
import { liveServer } from "#test/live/server.ts";

it("rejects unknown hints and invalid read keys at the Schema boundary", () => {
	const decode = Schema.decodeUnknownResult(LiveHint);
	for (const value of [{ _tag: "Unknown" }, { _tag: "Changed", keys: [{ _tag: "Item", collection: "documents", id: true }] }]) {
		expect(decode(value)._tag).toBe("Failure");
	}
	expect(decode({ _tag: "Changed", keys: [documents.item("one")] })._tag).toBe("Success");
});
it("reconciles the full explicit scope on each new stream even when its first hint is targeted", async () => {
	const server = await liveServer("", { _tag: "Changed", keys: [documents.item("one")] });
	const client = liveClient(server.url);
	const registry = AtomRegistry.make();
	const two = client.api.get.query({ id: "two" });
	registry.mount(two);
	try {
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(two), () => undefined)?.body).toBe("Second"));
		registry.mount(client.connection);
		await vi.waitFor(() => expect(Effect.runSync(Ref.get(server.reads)).filter((id) => id === "two")).toHaveLength(2));
		await server.disconnect();
		await vi.waitFor(() => expect(Effect.runSync(Ref.get(server.reads)).filter((id) => id === "two")).toHaveLength(3));
	} finally {
		registry.dispose();
		await server.close();
	}
});
it("defers resume reconciliation while paused until the consumer unpauses", async () => {
	const server = await liveServer();
	const client = liveClient(server.url);
	const registry = AtomRegistry.make();
	const one = client.api.get.query({ id: "one" });
	registry.mount(client.connection);
	registry.mount(one);
	try {
		await vi.waitFor(() => expect(registry.get(client.status).connection).toBe("live"));
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First"));
		registry.set(client.paused, true);
		await server.edit("one", "Changed while paused");
		await vi.waitFor(() => expect(registry.get(client.status).pending).toBe(1));
		const reads = Effect.runSync(Ref.get(server.reads));
		registry.set(client.resume, 1);
		expect(registry.get(client.status)).toMatchObject({ needsResync: true, pending: 1 });
		expect(Effect.runSync(Ref.get(server.reads))).toEqual(reads);
		expect(registry.get(one).waiting).toBe(false);
		expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First");
		registry.set(client.paused, false);
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("Changed while paused"));
		expect(registry.get(client.status)).toMatchObject({ needsResync: false, pending: 0 });
	} finally {
		registry.dispose();
		await server.close();
	}
});
it("continues native HTTP live updates when the optional resume signal is omitted", async () => {
	const server = await liveServer();
	const client = liveClient(server.url, {}, false);
	const registry = AtomRegistry.make();
	const one = client.api.get.query({ id: "one" });
	registry.mount(client.connection);
	registry.mount(one);
	try {
		await vi.waitFor(() => expect(registry.get(client.status).connection).toBe("live"));
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First"));
		await server.edit("one", "Changed without resume signal");
		await vi.waitFor(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("Changed without resume signal"));
		expect(Effect.runSync(Ref.get(server.active))).toBe(1);
	} finally {
		registry.dispose();
		await server.close();
	}
});
