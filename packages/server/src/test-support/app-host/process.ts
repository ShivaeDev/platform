import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Deferred, Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { TestClock } from "effect/testing";
import { acknowledgeHostSignal, reportHostReady } from "@shivaedev/test-kits/host/processChild.ts";
import { hostProcessReadouts } from "@shivaedev/test-kits/host/processReadouts.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { appHost } from "#appHost.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		if (process.argv[2] === "exit-before-ready") {
			return;
		}
		const clock = yield* Clock.Clock;
		let greeting = "hello";
		const readouts = yield* hostProcessReadouts;
		const hostScope = yield* Scope.make();
		const workerScope = yield* Scope.make();
		const shutdownScope = yield* Scope.fork(yield* Scope.Scope);
		yield* Scope.addFinalizer(shutdownScope, readouts.finalizer("HTTP host", Scope.close(hostScope, Exit.void)));
		yield* Scope.addFinalizer(
			shutdownScope,
			readouts.finalizer("background workers", Scope.close(workerScope, Exit.void).pipe(Effect.andThen(TestClock.adjust("60 millis")))),
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
				? PgClient.layer({
						applicationName: `host-process-${process.pid}`,
						url: Redacted.make(postgresTestUrl("DATABASE_URL").url ?? "postgresql://integration-tests-disabled"),
					})
				: Layer.empty;
		const context = yield* Layer.buildWithScope(
			appHost({ config: { disablePreemptiveShutdown: true, port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback", routes, services }),
			hostScope,
		);
		function handle() {
			greeting = "goodbye";
			Effect.runFork(acknowledgeHostSignal("SIGUSR2").pipe(Effect.provideService(Clock.Clock, clock)));
		}
		function finishRefresh() {
			Effect.runFork(
				Deferred.succeed(refresh, undefined).pipe(
					Effect.andThen(Fiber.join(refreshing)),
					Effect.andThen(acknowledgeHostSignal("SIGUSR1")),
					Effect.provideService(Clock.Clock, clock),
				),
			);
		}
		function shutdown() {
			Effect.runFork(
				readouts
					.shutdown(Scope.close(shutdownScope, Exit.void))
					.pipe(
						Effect.andThen(acknowledgeHostSignal("SIGHUP")),
						Effect.andThen(Deferred.succeed(stopped, undefined)),
						Effect.provideService(Clock.Clock, clock),
					),
			);
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => process.on("SIGUSR2", handle).on("SIGUSR1", finishRefresh).on("SIGHUP", shutdown)),
			() => Effect.sync(() => process.off("SIGUSR2", handle).off("SIGUSR1", finishRefresh).off("SIGHUP", shutdown)),
		);
		yield* reportHostReady.pipe(Effect.provideContext(context));
		yield* Deferred.await(stopped);
	}).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
);
