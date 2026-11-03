import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { appHost } from "#appHost.ts";
import { acknowledgeHostSignal, reportHostReady } from "#testing/hostProcessChild.ts";
import { hostProcessReadouts } from "#testing/hostProcessReadouts.ts";
import { Ping, pingHandlers } from "./ping.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		if (process.argv[2] === "exit-before-ready") {
			return;
		}
		let greeting = "hello";
		const readouts = yield* hostProcessReadouts;
		const hostScope = yield* Scope.make();
		const workerScope = yield* Scope.make();
		const shutdownScope = yield* Scope.fork(yield* Scope.Scope);
		yield* Scope.addFinalizer(shutdownScope, readouts.finalizer("HTTP host", Scope.close(hostScope, Exit.void)));
		yield* Scope.addFinalizer(
			shutdownScope,
			readouts.finalizer("background workers", Scope.close(workerScope, Exit.void).pipe(Effect.andThen(Effect.sleep("60 millis")))),
		);
		const refresh = yield* Deferred.make<void>();
		const refreshing = yield* readouts
			.work(process.argv[2] === "same-work-names" ? "notification stream" : "greeting refresh", Deferred.await(refresh))
			.pipe(Effect.forkIn(workerScope, { startImmediately: true }));
		yield* readouts.work("notification stream", Effect.never).pipe(Effect.forkIn(workerScope, { startImmediately: true }));
		const stopped = yield* Deferred.make<void>();
		const routes = HttpRouter.use((router) =>
			router.add(
				"GET",
				"/greeting",
				Effect.sync(() => HttpServerResponse.text(greeting, { headers: { "x-greeting": greeting } })),
			),
		);
		const services =
			process.argv[2] === "database"
				? PgClient.layer({ applicationName: `host-process-${process.pid}`, url: yield* Config.Redacted("DATABASE_URL") })
				: Layer.empty;
		const context = yield* Layer.buildWithScope(
			appHost({ config: { disablePreemptiveShutdown: true, port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback", routes, services }),
			hostScope,
		);
		function handle() {
			greeting = "goodbye";
			Effect.runFork(acknowledgeHostSignal("SIGUSR2"));
		}
		function finishRefresh() {
			Effect.runFork(
				Deferred.succeed(refresh, undefined).pipe(Effect.andThen(Fiber.join(refreshing)), Effect.andThen(acknowledgeHostSignal("SIGUSR1"))),
			);
		}
		function shutdown() {
			Effect.runFork(
				readouts
					.shutdown(Scope.close(shutdownScope, Exit.void))
					.pipe(Effect.andThen(acknowledgeHostSignal("SIGHUP")), Effect.andThen(Deferred.succeed(stopped, undefined))),
			);
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => process.on("SIGUSR2", handle).on("SIGUSR1", finishRefresh).on("SIGHUP", shutdown)),
			() => Effect.sync(() => process.off("SIGUSR2", handle).off("SIGUSR1", finishRefresh).off("SIGHUP", shutdown)),
		);
		yield* reportHostReady.pipe(Effect.provideContext(context));
		yield* Deferred.await(stopped);
	}).pipe(Effect.scoped),
);
