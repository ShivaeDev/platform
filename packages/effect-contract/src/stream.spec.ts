import { Cause, Effect, Exit, Ref, Result, Stream } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { documents, Unavailable } from "#test/live/contract.ts";
import { streamingDocuments } from "#test/live/streamingDocuments.ts";

let subscription: Awaited<ReturnType<typeof streamingDocuments>>;
afterEach(async () => subscription?.close());
it("delivers declared elements through the bound native HTTP stream and releases its scope on completion", async () => {
	subscription = await streamingDocuments();
	const test = subscription;
	const received = test.run(Stream.runCollect(test.api.subscribe.run(undefined).pipe(Stream.take(2))));
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.active))).toBe(1));
	await test.edit("one", "Changed");
	expect(await received).toEqual(Exit.succeed([{ _tag: "Resync" }, { _tag: "Changed", keys: [documents.item("one")] }]));
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.active))).toBe(0));
});
it("decodes a declared stream rejection into its shared tagged class", async () => {
	subscription = await streamingDocuments();
	const test = subscription;
	Effect.runSync(Ref.set(test.streamUnavailable, true));
	const exit = await test.run(Effect.result(Stream.runCollect(test.api.subscribe.run(undefined))));
	expect(Exit.isSuccess(exit)).toBe(true);
	if (Exit.isSuccess(exit)) {
		expect(Result.isFailure(exit.value) && exit.value.failure).toBeInstanceOf(Unavailable);
	}
});
it("interrupting the bound client releases the active server stream over HTTP", async () => {
	subscription = await streamingDocuments();
	const test = subscription;
	const controller = new AbortController();
	const received = test.run(Stream.runDrain(test.api.subscribe.run(undefined)), controller.signal);
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.active))).toBe(1));
	controller.abort();
	const exit = await received;
	expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
	await vi.waitFor(() => expect(Effect.runSync(Ref.get(test.active))).toBe(0));
});
