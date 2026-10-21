import { NodeHttpClient, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Cause, Context, Effect, Layer } from "effect";
import { HttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { fleetHealth } from "@shivaedev/work-board/server/diagnostics/fleetHealth.ts";
import { daemonLayer } from "#host/daemon.ts";
import { RPC_PATH } from "#host/daemonContract.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { daemonResources } from "#test/daemonResources.ts";
import { finishWorkers } from "#test/engine.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { MAIN } from "#test/mainSource.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

const peerReads = Effect.fn("DaemonTest.peerReads")(function* (url: string, index: number) {
	const peer = yield* daemonClient(url, { "x-request-id": `peer-${index}` });
	expect((yield* peer("fleet.get", { workId: "one" })).attempts).toHaveLength(1);
	expect((yield* peer("fleet.get", { workId: "missing" }).pipe(Effect.flip))._tag).toBe("NotFound");
}, Effect.scoped);

const resourceStory = Effect.fn("DaemonTest.resourceStory")(function* (fixture: HostFixture) {
	const resources = yield* daemonResources(fixture.parts.provider, fixture.host);
	const logs = captureLogs();
	yield* Effect.scoped(
		Effect.gen(function* () {
			const parts = { ...fixture.parts, integrations: engineIntegrations({}, []), provider: resources.provider };
			const context = yield* Layer.build(daemonLayer(fixture.host, parts, 0));
			yield* until(() =>
				fleetHealth(fixture.host.boardDir).pipe(
					Effect.map((health) => health.lastSchedulerPass !== null),
					Effect.provide(NodeServices.layer),
				),
			);
			const address = Context.get(context, HttpServer.HttpServer).address;
			const url = HttpServer.formatAddress(address);
			expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
			const client = yield* daemonClient(url);
			fixture.write("one.md", task("one", "approved"));
			yield* client("fleet.prepare", {
				cwd: "/synthetic-repository",
				preparation: prepared({ baseRevision: MAIN.revision, ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
				prompt: "Synthetic work",
				workId: "one",
			});
			const dispatched = yield* client("fleet.dispatch", { workId: "one" });
			expect(dispatched.decision).toBeUndefined();
			expect(dispatched.step).toBe("working");
			const { peak } = yield* resources.peakConnections(
				Effect.forEach(
					Array.from({ length: 12 }, (_, index) => index),
					(index) => peerReads(url, index),
					{ concurrency: "unbounded" },
				),
			);
			expect(peak).toBeGreaterThan(0);
			expect(peak).toBeLessThanOrEqual(2);
			finishWorkers(fixture.provider);
			expect((yield* client("fleet.reconcile", { workId: "one" })).step).toBe("done");
			expect((yield* client("fleet.views", undefined)).completed).toHaveLength(1);
			expect(resources.providers).toBe(1);
			expect(resources.releases).toBe(0);
			const ids = logs.entries.filter((entry) => entry.annotations["rpc.method"] === "fleet.get").map((entry) => entry.annotations.requestId);
			expect(new Set(ids)).toEqual(new Set(Array.from({ length: 12 }, (_, index) => `peer-${index}`)));
			yield* client("fleet.get", { workId: "missing" }).pipe(Effect.flip);
			expect(logs.entries.at(-1)?.annotations.requestId).toMatch(/^[a-f0-9]{32}$/u);
		}).pipe(Effect.provide(logs.layer)),
	);
	yield* until(() => Effect.map(resources.connections, (count) => count === 0));
	expect(resources.releases).toBe(1);
});

const originStory = Effect.fn("DaemonTest.originStory")(function* (fixture: HostFixture) {
	const context = yield* Layer.build(daemonLayer(fixture.host, fixture.parts, 0));
	const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
	for (const headers of [
		{ "content-type": "application/ndjson", origin: "https://example.invalid" },
		{ "content-type": "application/ndjson", host: "example.invalid" },
		{ "content-type": "text/plain" },
	]) {
		const response = yield* HttpClient.post(`${url}${RPC_PATH}`, { headers }).pipe(Effect.provide(NodeHttpClient.layerNodeHttp));
		expect(response.status).toBe(403);
	}
}, Effect.scoped);

const occupiedPortStory = Effect.fn("DaemonTest.occupiedPortStory")(function* (fixture: HostFixture) {
	const context = yield* Layer.build(daemonLayer(fixture.host, fixture.parts, 0));
	yield* until(() =>
		fleetHealth(fixture.host.boardDir).pipe(
			Effect.map((health) => health.lastSchedulerPass !== null),
			Effect.provide(NodeServices.layer),
		),
	);
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("Expected a TCP listener");
	}
	fixture.write("one.md", task("one", "approved"));
	const collision = yield* Effect.scoped(Layer.build(daemonLayer(fixture.host, fixture.parts, address.port))).pipe(Effect.exit);
	expect(collision._tag).toBe("Failure");
	if (collision._tag === "Failure") {
		expect(Cause.pretty(collision.cause)).toContain("EADDRINUSE");
	}
	expect(fixture.provider.launched).toHaveLength(0);
}, Effect.scoped);

describe("local Fleet daemon against PostgreSQL and HTTP", () => {
	const test = postgresTests("live");
	test(
		"HTTP operations stay within the configured PostgreSQL connections, close them on shutdown, share one provider lifetime and carry request ids",
		() => withHost({}, { database: { maxConnections: 2 }, intervalSeconds: 60 }, resourceStory),
		30_000,
	);
	test("rejects browser cross-origin, rebinding hosts and non-NDJSON requests before RPC", () => withHost({}, {}, originStory), 30_000);
	test("an occupied listener prevents a second daemon from scheduling work", () => withHost({}, { intervalSeconds: 60 }, occupiedPortStory), 30_000);
});
