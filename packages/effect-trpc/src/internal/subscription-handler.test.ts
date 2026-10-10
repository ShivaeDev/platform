import { initTRPC } from "@trpc/server";
import { Effect, Layer, ManagedRuntime, Stream } from "effect";
import { expect, it } from "vitest";
import { makeEffectTRPC } from "#adapter.ts";
import { makeRequestServices } from "#request-services.ts";

it("redacts synchronous request Layer defects while mapping the subscription cause", async () => {
	const runtime = ManagedRuntime.make(Layer.empty);
	const mapped: Array<{ origin: string; path: string }> = [];
	try {
		const adapter = makeEffectTRPC({
			mapError: (_error, context) => {
				mapped.push({ origin: context.origin, path: context.path });
				return undefined;
			},
			runtime,
		});
		const t = initTRPC.create();
		const requestServices = makeRequestServices((): Layer.Layer<never> => {
			throw new Error("private request Layer detail");
		});
		const router = t.router({
			events: adapter.procedure(t.procedure, requestServices).subscription(function* () {
				yield* Effect.void;
				return Stream.empty;
			}),
		});
		const caller = router.createCaller({});
		async function consume() {
			const stream = await caller.events(undefined);
			for await (const value of stream) {
				throw new Error(`Unexpected subscription value: ${String(value)}`);
			}
		}

		await expect(consume()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
		});
		expect(mapped).toEqual([{ origin: "defect", path: "events" }]);
	} finally {
		await runtime.dispose();
	}
});
