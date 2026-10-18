import { EventEmitter } from "node:events";
import { Effect, Layer, Logger, References } from "effect";
import { expect, it } from "vitest";
import { makePgBoss } from "#service.ts";
import { constructorOptions } from "#test/fake-client.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

it.each(["start", "stop", "failed start"])("observes connection termination during %s and detaches after shutdown", async (phase) => {
	const events = new EventEmitter();
	const failure = Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" });
	const logs: unknown[] = [];
	const logger = Logger.make(({ logLevel, message }) => logs.push({ logLevel, message }));
	const client = scriptedClient({
		off: (event, listener) => events.off(event, listener),
		on: (event, listener) => events.on(event, listener),
		start: () => {
			if (phase !== "stop") {
				events.emit("error", failure);
			}
			if (phase === "failed start") {
				throw failure;
			}
			return Promise.resolve();
		},
		stop: () => {
			if (phase === "stop") {
				events.emit("error", failure);
			}
			return Promise.resolve();
		},
	});
	const Jobs = makePgBoss("@test/ClientErrorJobs");
	const result = await Effect.runPromise(
		Effect.scoped(Layer.build(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [] }))).pipe(
			Effect.exit,
			Effect.provide(Logger.layer([logger])),
			Effect.provideService(References.MinimumLogLevel, "Debug"),
		),
	);
	expect(result._tag).toBe(phase === "failed start" ? "Failure" : "Success");
	expect(logs).toContainEqual({ logLevel: "Debug", message: [{ event: "pg_boss_error", message: failure.message }] });
	expect(events.listenerCount("error")).toBe(0);
});
