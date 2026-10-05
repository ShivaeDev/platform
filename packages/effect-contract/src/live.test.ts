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
