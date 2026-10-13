import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import { daemonLayer } from "#host/daemon.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { until } from "#test/cloudRestart.ts";
import { MAIN, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

function schedulerObserved(root: string) {
	return fleetHealth(root).pipe(
		Effect.map((health) => health.lastSchedulerPass !== null),
		Effect.provide(NodeServices.layer),
	);
}

describe("Fleet errors over daemon HTTP", () => {
	const test = postgresTests("live");
	test("clients retain missing, invalid, denied and stale errors in the error channel", () =>
		withHost({}, { intervalSeconds: 60 }, (fixture) =>
			Effect.scoped(
				Effect.gen(function* () {
					const context = yield* Layer.build(daemonLayer(fixture.host, fixture.parts, 0));
					const address = Context.get(context, HttpServer.HttpServer).address;
					if (!NetAddress.isInetAddress(address)) {
						return yield* Effect.die("Expected a TCP listener");
					}
					yield* until(() => schedulerObserved(fixture.host.boardDir));
					fixture.write("one.md", task("one", "approved"));
					const port = address.port;
					const missing = yield* daemonRequest(port, (client) => client("fleet.get", { workId: "missing" })).pipe(Effect.flip);
					expect(missing).toBeInstanceOf(NotFound);
					expect(missing.message).toBe("Unknown Board work missing");
					yield* daemonRequest(port, (client) =>
						client("fleet.prepare", { cwd: "/synthetic", preparation: prepared(), prompt: "Work", workId: "one" }),
					);
					const invalid = yield* daemonRequest(port, (client) => client("fleet.continue", { message: "", workId: "one" })).pipe(Effect.flip);
					expect(invalid).toBeInstanceOf(BadRequest);
					expect(invalid.message).toBe("Continuation needs a message");
					const denied = yield* daemonRequest(port, (client) => client("fleet.continue", { message: "Continue", workId: "one" })).pipe(Effect.flip);
					expect(denied).toBeInstanceOf(Forbidden);
					expect(denied.message).toBe("Continue requires terminal needs-human or completed work");
					const stale = yield* daemonRequest(port, (client) =>
						client("fleet.reassign", { attentionOwner: "orchestrator", decisionId: "old-decision", workId: "one" }),
					).pipe(Effect.flip);
					expect(stale).toBeInstanceOf(Conflict);
					expect(stale.message).toBe("The waiting decision changed");
				}),
			),
		));
	test("daemon commands preserve integration errors without a transport wrapper", () =>
		withHost({}, { intervalSeconds: 60 }, (fixture) =>
			Effect.scoped(
				Effect.gen(function* () {
					const main = Layer.succeed(MainSource, {
						current: Effect.succeed(MAIN),
						observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
						refresh: Effect.fail(new ServiceUnavailable({ message: "Git observation unavailable" })),
						repositoryRoot: "/synthetic",
					});
					const context = yield* Layer.build(daemonLayer(fixture.host, { ...fixture.parts, main }, 0));
					const address = Context.get(context, HttpServer.HttpServer).address;
					if (!NetAddress.isInetAddress(address)) {
						return yield* Effect.die("Expected a TCP listener");
					}
					fixture.write("one.md", task("one", "approved"));
					const failure = yield* daemonRequest(address.port, (client) => client("daemon.dispatch", { workId: "one" })).pipe(Effect.flip);
					expect(failure).toBeInstanceOf(ServiceUnavailable);
					expect(failure.message).toBe("Git observation unavailable");
				}),
			),
		));
});
