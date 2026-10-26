import { Context, Effect, Fiber, Redacted, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { PgBossError, PgBossPayloadError } from "#error.ts";
import { boss } from "#test/boss.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

class ErrorReporter extends Context.Service<ErrorReporter, (error: Error) => void>()("@test/PgBossErrorReporter") {}

boss.it("delivers background errors to the captured onError service only while its scope is open", [], function* ({ boot, events }) {
	const reported = Promise.withResolvers<Error>();
	const delivered: Error[] = [];
	const failure = new Error("pg-boss background worker stopped unexpectedly");
	const client = scriptedClient({ off: (event, listener) => events.off(event, listener), on: (event, listener) => events.on(event, listener) });
	const runtime = yield* boot([], {
		clientFactory: () => client,
		onError: (error) => Effect.flatMap(ErrorReporter, (report) => Effect.sync(() => report(error))),
	}).pipe(
		Effect.provideService(ErrorReporter, (error) => {
			delivered.push(error);
			reported.resolve(error);
		}),
	);
	expect(events.listeners("error")).toEqual([expect.any(Function)]);
	events.emit("error", failure);
	expect(yield* Effect.promise(() => reported.promise)).toBe(failure);
	yield* runtime.stop;
	events.emit("error", Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }));
	expect(delivered).toEqual([failure]);
});

boss.it("fails both concurrent cached builds on startup failure and starts afresh on retry", [], function* ({ boot }) {
	const startup = Promise.withResolvers<void>();
	const failure = new Error("external client initialization failed");
	const stop = vi.fn(async () => undefined);
	const failedClient = scriptedClient({ start: () => startup.promise, stop });
	const factory = vi.fn().mockReturnValueOnce(failedClient).mockReturnValueOnce(scriptedClient({}));
	const options = { clientCacheKey: Symbol("failed-start"), clientFactory: factory };
	const first = yield* boot([], options).pipe(Effect.exit, Effect.forkChild);
	const second = yield* boot([], options).pipe(Effect.exit, Effect.forkChild);
	yield* Effect.promise(() => vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(1)));
	startup.reject(failure);
	for (const result of [yield* Fiber.join(first), yield* Fiber.join(second)]) {
		expect(result._tag).toBe("Failure");
		const error = yield* Effect.flip(result);
		expect(error).toBeInstanceOf(PgBossError);
		if (!(error instanceof PgBossError)) {
			throw error;
		}
		expect(error.operation).toBe("start");
		expect(error._tag === "PgBossError" && Redacted.value(error.original)).toBe(failure);
	}
	expect(stop).toHaveBeenCalledTimes(1);
	yield* boot([], options);
	expect(factory).toHaveBeenCalledTimes(2);
});

boss.it("preserves the startup error when best-effort cleanup also fails", [], function* ({ boot }) {
	const failure = new Error("external client initialization failed");
	const stop = vi.fn(() => Promise.reject(new Error("external client teardown failed")));
	const client = scriptedClient({ start: () => Promise.reject(failure), stop });
	const error = yield* Effect.flip(boot([], { clientFactory: () => client }));
	expect(error).toBeInstanceOf(PgBossError);
	if (!(error instanceof PgBossError)) {
		throw error;
	}
	expect(error.operation).toBe("start");
	expect(error._tag === "PgBossError" && Redacted.value(error.original)).toBe(failure);
	expect(stop).toHaveBeenCalledTimes(1);
});

boss.it("logs a failed stop without failing the scope and evicts the cached client", [], function* ({ boot, logs }) {
	const failure = new Error("external client teardown failed");
	const stop = vi.fn(() => Promise.reject(failure));
	const factory = vi.fn().mockReturnValueOnce(scriptedClient({ stop })).mockReturnValueOnce(scriptedClient({}));
	const options = { clientCacheKey: Symbol("failed-stop"), clientFactory: factory };
	const first = yield* boot([], options);
	yield* first.stop;
	expect(stop).toHaveBeenCalledTimes(1);
	expect(logs).toMatchObject([{ message: [expect.any(PgBossError)] }]);
	const message = logs[0]?.message;
	const error = Array.isArray(message) ? message[0] : message;
	expect(error).toBeInstanceOf(PgBossError);
	if (!(error instanceof PgBossError)) {
		throw error;
	}
	expect(error.operation).toBe("stop");
	expect(Redacted.value(error.original)).toBe(failure);
	const second = yield* boot([], options);
	yield* second.stop;
	expect(factory).toHaveBeenCalledTimes(2);
});

boss.it("replaces a cached schedule worker before registering its new handler", [], function* ({ boot, client }) {
	const calls: string[] = [];
	const offWork = client.offWork.bind(client);
	const work = client.work.bind(client);
	client.offWork = (name) => {
		calls.push(`off:${name}`);
		return offWork(name);
	};
	client.work = (name, workOptions, run) => {
		calls.push(`work:${name}`);
		return work(name, workOptions, run);
	};
	const Cleanup = defineSchedule({ cron: "17 3 * * *", name: "cached-cleanup" });
	const options = { clientCacheKey: Symbol("cached-schedule") };
	const first = yield* boot([Cleanup.run(Effect.void)], options);
	const second = yield* boot([Cleanup.run(Effect.void)], options);
	expect(calls).toEqual(["work:cached-cleanup", "off:cached-cleanup", "work:cached-cleanup"]);
	yield* first.stop;
	yield* second.stop;
});

boss.it("rejects duplicate job names before registering either worker", [], function* ({ boot, client }) {
	const reported: Error[] = [];
	const Queue = defineQueue({ name: "duplicate", schema: Schema.Struct({}) });
	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "duplicate" });
	const error = yield* Effect.flip(
		boot([Queue.handle(() => Effect.void), Schedule.run(Effect.void)], { onError: (failure) => Effect.sync(() => reported.push(failure)) }),
	);
	expect(error).toBeInstanceOf(PgBossError);
	if (!(error instanceof PgBossError)) {
		throw error;
	}
	expect(error.operation).toBe("register");
	expect(error._tag === "PgBossError" && Redacted.value(error.original)).toEqual(new TypeError("pg-boss job names must be unique"));
	expect(error.message).toBe("pg-boss register failed: TypeError");
	expect(client.workers).toEqual([]);
	expect(client.lifecycle).toEqual(["start", "stop"]);
	for (const listener of client.errors) {
		listener(Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }));
	}
	expect(reported).toEqual([]);
});

boss.it("rejects an unencodable consumer payload before sending it", [], function* ({ boot, client }) {
	const Queue = defineQueue({ name: "encode-failure", schema: Schema.Struct({ id: Schema.NumberFromString.check(Schema.isFinite()) }) });
	const { jobs } = yield* boot([Queue]);
	const error = yield* Effect.flip(jobs.enqueue(Queue, { id: Number.NaN }));
	expect(error).toBeInstanceOf(PgBossPayloadError);
	if (!(error instanceof PgBossPayloadError)) {
		throw error;
	}
	expect(error.direction).toBe("encode");
	expect(error.queue).toBe("encode-failure");
	expect(String(Redacted.value(error.original))).toBe('SchemaError(Expected a finite number\n  at ["id"])');
	expect(client.sendCalls).toEqual([]);
});
