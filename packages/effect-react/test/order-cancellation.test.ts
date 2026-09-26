import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { expect, test } from "vitest";
import { Orders } from "./order-example/contract.ts";
import { startOrderServer } from "./order-example/http-test.ts";

test("interrupting a real HTTP RPC releases server work before the save can run", async () => {
	const entered = Deferred.makeUnsafe<void>();
	const released = Deferred.makeUnsafe<Exit.Exit<unknown, unknown>>();
	const resume = Deferred.makeUnsafe<void>();
	const server = await startOrderServer({
		beforeSave: () =>
			Effect.scoped(
				Effect.gen(function* () {
					yield* Effect.addFinalizer((exit) => Deferred.succeed(released, exit).pipe(Effect.asVoid));
					yield* Deferred.succeed(entered, undefined);
					yield* Deferred.await(resume);
				}),
			),
	});
	const protocol = RpcClient.layerProtocolHttp({
		url: server.url,
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", "Bearer alice-session")),
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]));
	try {
		await Effect.runPromise(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Orders);
				const saving = yield* Effect.forkChild(client["orders.save"]({ id: 1, name: "Cancelled order", quantity: 999 }));
				yield* Deferred.await(entered);
				yield* Fiber.interrupt(saving);
				const releaseExit = yield* Deferred.await(released);
				expect(Exit.isFailure(releaseExit) && Cause.hasInterrupts(releaseExit.cause)).toBe(true);
				yield* Deferred.succeed(resume, undefined);
				expect(yield* client["orders.get"]({ id: 1 })).toMatchObject({
					name: "Printer paper",
					quantity: 300,
				});
			}).pipe(Effect.scoped, Effect.provide(protocol), Effect.timeout("3 seconds")),
		);
	} finally {
		await Effect.runPromise(Deferred.succeed(resume, undefined));
		await server.close();
	}
});
