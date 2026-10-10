import { Context, Effect, Layer, Logger, Redacted, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { PgBossError, PgBossPayloadError } from "#error.ts";
import { makeService } from "#internal/service.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions } from "#test/fake-client.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

class ErrorReporter extends Context.Service<ErrorReporter, (error: Error) => void>()("@test/PgBossErrorReporter") {}

describe("pg-boss external lifecycle boundaries", () => {
	it("delivers background errors to the captured onError service and removes its listener", async () => {
		const reported = Promise.withResolvers<Error>();
		const failure = new Error("pg-boss background worker stopped unexpectedly");
		const listeners = new Set<(error: Error) => void>();
		const client = scriptedClient({
			off: (_event, listener) => listeners.delete(listener),
			on: (_event, listener) => listeners.add(listener),
			start: async () => undefined,
			stop: async () => undefined,
		});
		const Jobs = makePgBoss("@test/BackgroundErrorJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientFactory: () => client,
			jobs: [],
			onError: (error) => Effect.flatMap(ErrorReporter, (report) => Effect.sync(() => report(error))),
		}).pipe(Layer.provide(Layer.succeed(ErrorReporter, reported.resolve)));

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Jobs;
					expect(listeners.size).toBe(1);
					for (const listener of listeners) {
						listener(failure);
					}
					expect(yield* Effect.promise(() => reported.promise)).toBe(failure);
				}).pipe(Effect.provide(live)),
			),
		);
		expect(listeners.size).toBe(0);
	});

	it("fails both concurrent cached builds on startup failure and starts afresh on retry", async () => {
		const startup = Promise.withResolvers<void>();
		const failure = new Error("external client initialization failed");
		const stop = vi.fn(async () => undefined);
		const failedClient = scriptedClient({ start: () => startup.promise, stop });
		const replacement = scriptedClient({
			off: () => undefined,
			on: () => undefined,
			start: async () => undefined,
			stop: async () => undefined,
		});
		const factory = vi.fn().mockReturnValueOnce(failedClient).mockReturnValueOnce(replacement);
		const Jobs = makePgBoss("@test/ConcurrentStartFailureJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientCacheKey: Symbol("failed-start"),
			clientFactory: factory,
			jobs: [],
		});
		function build() {
			return Effect.runPromise(Effect.scoped(Layer.build(live)));
		}
		const outcomes = Promise.allSettled([build(), build()]);
		await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
		startup.reject(failure);

		for (const outcome of await outcomes) {
			expect(outcome.status).toBe("rejected");
			if (outcome.status !== "rejected") {
				throw new Error("A build unexpectedly acquired the failed client");
			}
			expect(outcome.reason).toBeInstanceOf(PgBossError);
			expect(outcome.reason.operation).toBe("start");
			expect(Redacted.value(outcome.reason.original)).toBe(failure);
		}
		expect(stop).toHaveBeenCalledTimes(1);
		await build();
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("preserves the startup error when best-effort cleanup also fails", async () => {
		const failure = new Error("external client initialization failed");
		const cleanupFailure = new Error("external client teardown failed");
		const stop = vi.fn(() => Promise.reject(cleanupFailure));
		const client = scriptedClient({
			start: () => Promise.reject(failure),
			stop,
		});
		const Jobs = makePgBoss("@test/StartAndStopFailureJobs");
		try {
			await Effect.runPromise(Effect.scoped(Layer.build(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [] }))));
			throw new Error("A build unexpectedly acquired the failed client");
		} catch (error) {
			expect(error).toBeInstanceOf(PgBossError);
			if (!(error instanceof PgBossError)) {
				throw error;
			}
			expect(error.operation).toBe("start");
			expect(Redacted.value(error.original)).toBe(failure);
		}
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("logs a failed stop without failing the scope and evicts the cached client", async () => {
		const failure = new Error("external client teardown failed");
		const messages: unknown[] = [];
		const logger = Logger.make(({ message }) => {
			messages.push(message);
		});
		const stop = vi.fn(() => Promise.reject(failure));
		const failedClient = scriptedClient({
			off: () => undefined,
			on: () => undefined,
			start: async () => undefined,
			stop,
		});
		const replacement = scriptedClient({
			off: () => undefined,
			on: () => undefined,
			start: async () => undefined,
			stop: async () => undefined,
		});
		const factory = vi.fn().mockReturnValueOnce(failedClient).mockReturnValueOnce(replacement);
		const Jobs = makePgBoss("@test/StopFailureJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientCacheKey: Symbol("failed-stop"),
			clientFactory: factory,
			jobs: [],
		});
		function build() {
			return Effect.runPromise(Effect.scoped(Layer.build(live)).pipe(Effect.provide(Logger.layer([logger]))));
		}
		await build();
		expect(stop).toHaveBeenCalledTimes(1);
		expect(messages).toHaveLength(1);
		const error = Array.isArray(messages[0]) ? messages[0][0] : messages[0];
		expect(error).toBeInstanceOf(PgBossError);
		if (!(error instanceof PgBossError)) {
			throw new Error("Missing typed stop error");
		}
		expect(error.operation).toBe("stop");
		expect(Redacted.value(error.original)).toBe(failure);
		await build();
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("replaces a cached schedule worker before registering its new handler", async () => {
		const calls: string[] = [];
		const client = scriptedClient({
			createQueue: (name) => {
				calls.push(`queue:${name}`);
				return Promise.resolve();
			},
			off: () => undefined,
			offWork: (name) => {
				calls.push(`off:${name}`);
				return Promise.resolve();
			},
			on: () => undefined,
			schedule: (name) => {
				calls.push(`schedule:${name}`);
				return Promise.resolve();
			},
			start: async () => undefined,
			stop: async () => undefined,
			work: (name) => {
				calls.push(`work:${name}`);
				return Promise.resolve("worker-id");
			},
		});
		const Cleanup = defineSchedule({ cron: "17 3 * * *", name: "cached-cleanup" });
		const Jobs = makePgBoss("@test/CachedScheduleJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientCacheKey: Symbol("cached-schedule"),
			clientFactory: () => client,
			jobs: [Cleanup.run(Effect.void)],
		});
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Layer.build(live);
					yield* Layer.build(live);
				}),
			),
		);
		expect(calls).toEqual([
			"queue:cached-cleanup-dlq",
			"queue:cached-cleanup",
			"work:cached-cleanup",
			"schedule:cached-cleanup",
			"off:cached-cleanup",
			"queue:cached-cleanup-dlq",
			"queue:cached-cleanup",
			"work:cached-cleanup",
			"schedule:cached-cleanup",
		]);
	});

	it("rejects duplicate job names before registering either worker", async () => {
		const stop = vi.fn(async () => undefined);
		const listeners = new Set<(error: Error) => void>();
		const client = scriptedClient({
			off: (_event, listener) => listeners.delete(listener),
			on: (_event, listener) => listeners.add(listener),
			start: async () => undefined,
			stop,
		});
		const Queue = defineQueue({ name: "duplicate", schema: Schema.Struct({}) });
		const Schedule = defineSchedule({ cron: "17 3 * * *", name: "duplicate" });
		const Jobs = makePgBoss("@test/DuplicateNamesJobs");
		try {
			await Effect.runPromise(
				Effect.scoped(
					Layer.build(
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [Queue.handle(() => Effect.void), Schedule.run(Effect.void)],
						}),
					),
				),
			);
			throw new Error("Duplicate registrations unexpectedly succeeded");
		} catch (error) {
			expect(error).toBeInstanceOf(PgBossError);
			if (!(error instanceof PgBossError)) {
				throw error;
			}
			expect(error.operation).toBe("register");
			expect(Redacted.value(error.original)).toEqual(new TypeError("pg-boss job names must be unique"));
		}
		expect(stop).toHaveBeenCalledTimes(1);
		expect(listeners.size).toBe(0);
	});

	it("rejects an unencodable consumer payload before sending it", async () => {
		const client = scriptedClient({});
		const Queue = defineQueue({ name: "encode-failure", schema: Schema.Struct({ id: Schema.NumberFromString.check(Schema.isFinite()) }) });
		const service = makeService(client, []);
		try {
			await Effect.runPromise(service.enqueue(Queue, { id: Number.NaN }));
			throw new Error("An unencodable payload unexpectedly succeeded");
		} catch (error) {
			expect(error).toBeInstanceOf(PgBossPayloadError);
			if (!(error instanceof PgBossPayloadError)) {
				throw error;
			}
			expect(error.direction).toBe("encode");
			expect(error.queue).toBe("encode-failure");
			expect(String(Redacted.value(error.original))).toBe('SchemaError(Expected a finite number\n  at ["id"])');
		}
	});
});
