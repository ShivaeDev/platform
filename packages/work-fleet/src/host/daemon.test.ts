import { expect } from "@effect/vitest";
import { Cause, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fleetDaemon } from "#test/daemonStory.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork } from "#test/hostStory.ts";
import { MAIN } from "#test/mainSource.ts";
import { noChangeHost } from "#test/noChangeHost.ts";
import { prepared } from "#test/preparation.ts";
import { observedConnections, readyScheduledHost } from "#test/scheduledHost.ts";

fleetDaemon.it(
	"HTTP operations stay within the configured PostgreSQL connections, close them on shutdown, share one provider lifetime and carry request ids",
	[boardWork({}, { database: { maxConnections: 2 }, intervalSeconds: 60 }), readyScheduledHost, observedConnections, noChangeHost],
	function* (daemon) {
		expect(daemon.address()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
		daemon.writeBoard("one.md", task("one", "approved"));
		yield* daemon.request("fleet.prepare", {
			cwd: "/synthetic-repository",
			preparation: prepared({ baseRevision: MAIN.revision, ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
			prompt: "Synthetic work",
			workId: "one",
		});
		const dispatched = yield* daemon.request("fleet.dispatch", { workId: "one" });
		expect(dispatched.decision).toBeUndefined();
		expect(dispatched.step).toBe("working");
		const { peak, value } = yield* daemon.peakConnections(
			Effect.forEach(
				Array.from({ length: 12 }, (_, index) => index),
				(index) => daemon.peerReads(index),
				{ concurrency: "unbounded" },
			),
		);
		for (const peer of value) {
			expect(peer.record.attempts).toHaveLength(1);
			expect(peer.missing._tag).toBe("NotFound");
		}
		expect(peak).toBeGreaterThan(0);
		expect(peak).toBeLessThanOrEqual(2);
		daemon.finishTurn(dispatched);
		expect((yield* daemon.reconcile("one")).step).toBe("done");
		expect((yield* daemon.request("fleet.views", undefined)).completed).toHaveLength(1);
		expect(daemon.providerResources()).toEqual({ providers: 1, releases: 0 });
		const ids = daemon
			.logs()
			.filter((entry) => entry.annotations["rpc.method"] === "fleet.get")
			.map((entry) => entry.annotations.requestId);
		expect(new Set(ids)).toEqual(new Set(Array.from({ length: 12 }, (_, index) => `peer-${index}`)));
		yield* daemon.request("fleet.get", { workId: "missing" }).pipe(Effect.flip);
		expect(daemon.logs().at(-1)?.annotations.requestId).toMatch(/^[a-f0-9]{32}$/u);
		yield* daemon.stop();
		yield* daemon.connectionsClosed();
		expect(daemon.providerResources().releases).toBe(1);
	},
	30_000,
);

fleetDaemon.it(
	"rejects browser cross-origin, rebinding hosts and non-NDJSON requests before RPC",
	[],
	function* (daemon) {
		for (const headers of [
			{ "content-type": "application/ndjson", origin: "https://example.invalid" },
			{ "content-type": "application/ndjson", host: "example.invalid" },
			{ "content-type": "text/plain" },
		]) {
			expect((yield* daemon.rawRequest(headers)).status).toBe(HttpStatus.fromLiteral("Forbidden"));
		}
	},
	30_000,
);

fleetDaemon.it(
	"an occupied listener prevents a second daemon from scheduling work",
	[boardWork({}, { intervalSeconds: 60 }), readyScheduledHost],
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		const collision = yield* daemon.startOnOccupiedPort();
		expect(collision._tag).toBe("Failure");
		if (collision._tag === "Failure") {
			expect(Cause.pretty(collision.cause)).toContain("EADDRINUSE");
		}
		expect(daemon.providerLaunches()).toHaveLength(0);
	},
	30_000,
);
