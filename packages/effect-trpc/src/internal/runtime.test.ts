import { TRPCError } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime, Stream } from "effect";
import { afterAll, expect, it } from "vitest";
import { makeContextBridge } from "#internal/context-bridge.ts";
import { makeRuntimeBridge } from "#internal/runtime.ts";

const runtime = ManagedRuntime.make(Layer.empty);
const bridge = makeRuntimeBridge(runtime, makeContextBridge(), {});
const procedure = {
	captureStackTrace: () => undefined,
	path: "cancelled",
	type: "query" as const,
};

afterAll(() => runtime.dispose());

it("maps pure interruption to CLIENT_CLOSED_REQUEST", async () => {
	const controller = new AbortController();
	controller.abort();

	let caught: unknown;
	try {
		await bridge.runEffect(Effect.never, {
			procedure,
			signal: controller.signal,
		});
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(TRPCError);
	expect(caught).toMatchObject({
		code: "CLIENT_CLOSED_REQUEST",
		message: "Request cancelled",
	});
});

it("redacts defects thrown by consumer instrumentation", async () => {
	const unsafeBridge = makeRuntimeBridge(runtime, makeContextBridge(), {
		instrument: () => {
			throw new Error("private instrumentation detail");
		},
	});

	await expect(unsafeBridge.runEffect(unsafeBridge.instrument(Effect.succeed("unreachable"), procedure), { procedure })).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Internal server error",
	});
});

it("redacts defects thrown by the consumer error mapper", async () => {
	const unsafeBridge = makeRuntimeBridge(runtime, makeContextBridge(), {
		mapError: () => {
			throw new Error("private mapper detail");
		},
	});

	await expect(unsafeBridge.runEffect(Effect.fail("domain failure"), { procedure })).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Internal server error",
	});
});

class SubscriptionValue extends Context.Service<SubscriptionValue, string>()("@test/SubscriptionValue") {}

it("ends a subscription whose transport aborted before iteration begins", async () => {
	const controller = new AbortController();
	controller.abort();
	const stream = await bridge.runStream(Stream.never, { procedure, signal: controller.signal });

	await expect(stream[Symbol.asyncIterator]().next()).resolves.toEqual({ done: true, value: undefined });
});

it("maps a subscription failure to the specific consumer error", async () => {
	const streamBridge = makeRuntimeBridge(runtime, makeContextBridge(), {
		mapError: (error, info) => {
			expect(error).toBe("subscription unavailable");
			expect(info).toMatchObject({ origin: "failure", path: "cancelled" });
			return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Updates temporarily unavailable" });
		},
	});
	const stream = await streamBridge.runStream(Stream.fail("subscription unavailable"), { procedure });

	await expect(stream[Symbol.asyncIterator]().next()).rejects.toMatchObject({
		code: "SERVICE_UNAVAILABLE",
		message: "Updates temporarily unavailable",
	});
});

it("uses ambient subscription services after the caller context has returned", async () => {
	const streamRuntime = ManagedRuntime.make(Layer.succeed(SubscriptionValue, "application"));
	const contextBridge = makeContextBridge();
	const streamBridge = makeRuntimeBridge(streamRuntime, contextBridge, {});
	try {
		const stream = await contextBridge.run(Context.make(SubscriptionValue, "test override"), () =>
			streamBridge.runStream(Stream.fromEffect(SubscriptionValue), { procedure }),
		);
		const values: string[] = [];
		for await (const value of stream) {
			values.push(value);
		}
		expect(values).toEqual(["test override"]);
	} finally {
		await streamRuntime.dispose();
	}
});
