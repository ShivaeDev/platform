import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { appHost } from "#appHost.ts";
import { acknowledgeHostSignal, reportHostReady } from "#testing/hostProcessChild.ts";
import { Ping, pingHandlers } from "./ping.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		if (process.argv[2] === "exit-before-ready") {
			return;
		}
		let greeting = "hello";
		const routes = HttpRouter.use((router) =>
			router.add(
				"GET",
				"/greeting",
				Effect.sync(() => HttpServerResponse.text(greeting, { headers: { "x-greeting": greeting } })),
			),
		);
		const services =
			process.argv[2] === "database"
				? PgClient.layer({ url: Redacted.make(process.argv[3] ?? "postgresql://integration-tests-disabled") })
				: Layer.empty;
		const context = yield* Layer.build(appHost({ config: { port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback", routes, services }));
		function handle() {
			greeting = "goodbye";
			Effect.runFork(acknowledgeHostSignal("SIGUSR2"));
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => process.on("SIGUSR2", handle)),
			() => Effect.sync(() => process.off("SIGUSR2", handle)),
		);
		yield* reportHostReady.pipe(Effect.provideContext(context));
		yield* Effect.never;
	}).pipe(Effect.scoped),
);
