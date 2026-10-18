import { EventEmitter } from "node:events";
import { Effect, Layer, Logger, References } from "effect";
import { expect, it } from "vitest";
import { makePgBoss } from "#service.ts";
import { constructorOptions } from "#test/fake-client.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

it.each(["failed stop", "pool kept open", "failed startup cleanup"])("still observes idle errors after %s", async (phase) => {
	const events = new EventEmitter();
	const failure = new Error("pg-boss could not stop");
	const logs: unknown[] = [];
	const logger = Logger.make(({ logLevel, message }) => logs.push({ logLevel, message }));
	const client = scriptedClient({
		off: (event, listener) => events.off(event, listener),
		on: (event, listener) => events.on(event, listener),
		start: () => (phase === "failed startup cleanup" ? Promise.reject(failure) : Promise.resolve()),
		stop: () => (phase === "pool kept open" ? Promise.resolve() : Promise.reject(failure)),
	});
	const Jobs = makePgBoss("@test/RetainedClientErrorJobs");
	const program = Effect.scoped(
		Layer.build(
			Jobs.layer({
				...constructorOptions,
				clientFactory: () => client,
				jobs: [],
				...(phase === "pool kept open" ? { stop: { close: false } } : {}),
			}),
		),
	).pipe(Effect.exit, Effect.provide(Logger.layer([logger])), Effect.provideService(References.MinimumLogLevel, "Debug"));
	const result = await Effect.runPromise(program);
	expect(result._tag).toBe(phase === "failed startup cleanup" ? "Failure" : "Success");
	const termination = Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" });
	expect(() => events.emit("error", termination)).not.toThrow();
	expect(logs).toContainEqual({ logLevel: "Debug", message: [{ event: "pg_boss_error", message: termination.message }] });
	expect(events.listenerCount("error")).toBe(1);
});
