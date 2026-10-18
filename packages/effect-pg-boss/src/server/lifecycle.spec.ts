import { Effect, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossError } from "#error.ts";
import { boss, clientFailsQueue, clientFailsStart } from "#test/boss.ts";
import { FakeClient } from "#test/fakeClient.ts";

boss.it("reuses and reference-counts a keyed client", [], function* ({ boot, client }) {
	const factory = vi.fn(() => client);
	const Queue = defineQueue({ name: "cached", schema: Schema.Struct({}) });
	const worker = Queue.handle(() => Effect.void);
	const options = { clientCacheKey: Symbol("cached"), clientFactory: factory };
	const first = yield* boot([worker], options);
	const second = yield* boot([worker], options);
	expect(client.stopCalls).toBe(0);
	yield* first.stop;
	expect(client.stopCalls).toBe(0);
	yield* second.stop;
	expect(factory).toHaveBeenCalledTimes(1);
	expect(client.startCalls).toBe(1);
	expect(client.offWorkCalls).toEqual(["cached"]);
	expect(client.stopCalls).toBe(1);
});

boss.it("starts a separate client per build without a cache key", [], function* ({ boot }) {
	const factory = vi.fn(() => new FakeClient());
	const first = yield* boot([], { clientFactory: factory });
	const second = yield* boot([], { clientFactory: factory });
	yield* first.stop;
	yield* second.stop;
	expect(factory).toHaveBeenCalledTimes(2);
});

boss.it("closes a started client when registration fails", [clientFailsQueue], function* ({ boot, client }) {
	const Queue = defineQueue({ name: "broken", schema: Schema.Struct({}) });
	const error = yield* Effect.flip(boot([Queue.handle(() => Effect.void)]));
	expect(error).toBeInstanceOf(PgBossError);
	expect(error).toMatchObject({ operation: "register" });
	expect(client.startCalls).toBe(1);
	expect(client.stopCalls).toBe(1);
});

boss.it("closes a partially acquired client when startup fails", [clientFailsStart], function* ({ boot, client }) {
	const error = yield* Effect.flip(boot([]));
	expect(error).toBeInstanceOf(PgBossError);
	expect(error).toMatchObject({ operation: "start" });
	expect(client.startCalls).toBe(1);
	expect(client.stopCalls).toBe(1);
});
