import { Effect, Layer, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { defineQueue, makePgBoss, PgBossError } from "../src/index.ts";
import { constructorOptions, FakeClient } from "./support/fake-client.ts";

describe("pg-boss client lifecycle", () => {
	it("reuses and reference-counts a keyed client", async () => {
		const client = new FakeClient();
		const factory = vi.fn(() => client);
		const Queue = defineQueue({ name: "cached", schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/CachedJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientCacheKey: Symbol("cached-jobs"),
			clientFactory: factory,
			jobs: [Queue.handle(() => Effect.void)],
		});

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Layer.build(live);
					yield* Layer.build(live);
					expect(client.stopCalls).toBe(0);
				}),
			),
		);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(client.startCalls).toBe(1);
		expect(client.offWorkCalls).toEqual(["cached"]);
		expect(client.stopCalls).toBe(1);
	});

	it("starts a separate client per build without a cache key", async () => {
		const factory = vi.fn(() => new FakeClient());
		const Jobs = makePgBoss("@test/UncachedJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientFactory: factory,
			jobs: [],
		});

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Layer.build(live);
					yield* Layer.build(live);
				}),
			),
		);

		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("closes a started client when registration fails", async () => {
		const client = new FakeClient();
		client.failCreateQueue = true;
		const Queue = defineQueue({ name: "broken", schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/BrokenJobs");

		await expect(
			Effect.runPromise(
				Effect.scoped(
					Effect.provide(
						Effect.asVoid(Jobs),
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [Queue.handle(() => Effect.void)],
						}),
					),
				),
			),
		).rejects.toBeInstanceOf(PgBossError);
		expect(client.startCalls).toBe(1);
		expect(client.stopCalls).toBe(1);
	});

	it("closes a partially acquired client when startup fails", async () => {
		const client = new FakeClient();
		client.failStart = true;
		const Jobs = makePgBoss("@test/StartFailureJobs");

		await expect(
			Effect.runPromise(
				Effect.scoped(
					Effect.provide(
						Effect.asVoid(Jobs),
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [],
						}),
					),
				),
			),
		).rejects.toBeInstanceOf(PgBossError);
		expect(client.startCalls).toBe(1);
		expect(client.stopCalls).toBe(1);
	});
});
