import { TRPCError } from "@trpc/server";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterAll, expect, it } from "vitest";
import { makeContextBridge } from "../src/internal/context-bridge.js";
import { makeRuntimeBridge } from "../src/internal/runtime.js";

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

	await expect(
		unsafeBridge.runEffect(Effect.succeed("unreachable"), { procedure }),
	).rejects.toMatchObject({
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

	await expect(
		unsafeBridge.runEffect(Effect.fail("domain failure"), { procedure }),
	).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Internal server error",
	});
});
