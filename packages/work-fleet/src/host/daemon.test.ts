import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { fleetDaemon } from "#test/daemonStory.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork } from "#test/hostStory.ts";
import { MAIN } from "#test/mainSource.ts";
import { noChangeHost } from "#test/noChangeHost.ts";
import { prepared } from "#test/preparation.ts";
import { refusal } from "#test/refusal.ts";
import { observedConnections } from "#test/scheduledHost.ts";

const MAX_CONNECTIONS = 2;
const PEERS = 12;
const PREPARATION = {
	cwd: "/synthetic-repository",
	preparation: prepared({ baseRevision: MAIN.revision, ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
	prompt: "Synthetic work",
	workId: "one",
};
const CONNECTION_LIMIT = [boardWork({}, { database: { maxConnections: MAX_CONNECTIONS }, intervalSeconds: 60 }), observedConnections, noChangeHost];

fleetDaemon.it(
	"concurrent HTTP reads from twelve peers stay within the two configured PostgreSQL connections",
	CONNECTION_LIMIT,
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		yield* daemon.request("fleet.prepare", PREPARATION);
		yield* daemon.request("fleet.dispatch", { workId: "one" });

		const { peak, value: reads } = yield* daemon.peerReadsTogether(PEERS);

		expect(reads).toEqual(Array.from({ length: PEERS }, () => ({ attempts: 1, missing: expect.stringMatching(/^not found: /u) })));
		expect(peak).toBeGreaterThan(0);
		expect(peak).toBeLessThanOrEqual(MAX_CONNECTIONS);
	},
	30_000,
);

fleetDaemon.it(
	"each HTTP request logs the caller's request id, and a request without one logs a generated id",
	CONNECTION_LIMIT,
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		yield* daemon.request("fleet.prepare", PREPARATION);

		yield* daemon.peerReadsTogether(PEERS);
		yield* refusal(daemon.request("fleet.get", { workId: "missing" }));

		const ids = daemon
			.logs()
			.filter((entry) => entry.annotations["rpc.method"] === "fleet.get")
			.map((entry) => entry.annotations.requestId);
		expect(new Set(ids.slice(0, -1))).toEqual(new Set(Array.from({ length: PEERS }, (_, index) => `peer-${index}`)));
		expect(ids.at(-1)).toMatch(/^[a-f0-9]{32}$/u);
	},
	30_000,
);

fleetDaemon.it(
	"HTTP work shares one provider lifetime, and shutdown releases it and closes every PostgreSQL connection",
	CONNECTION_LIMIT,
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		yield* daemon.request("fleet.prepare", PREPARATION);
		daemon.finishTurn(yield* daemon.request("fleet.dispatch", { workId: "one" }));
		expect(yield* daemon.reconcile("one")).toMatchObject({ step: "done" });
		expect(daemon.providerResources()).toEqual({ providers: 1, releases: 0 });

		yield* daemon.stop();

		yield* daemon.connectionsClosed();
		expect(daemon.providerResources()).toEqual({ providers: 1, releases: 1 });
	},
	30_000,
);

for (const [request, headers] of [
	["a browser cross-origin request", { "content-type": "application/ndjson", origin: "https://example.invalid" }],
	["a rebinding host", { "content-type": "application/ndjson", host: "example.invalid" }],
	["a non-NDJSON request", { "content-type": "text/plain" }],
] as const) {
	fleetDaemon.it(
		`the daemon forbids ${request} before RPC`,
		[],
		function* (daemon) {
			const status = yield* daemon.rawRequestStatus(headers);

			expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
		},
		30_000,
	);
}

fleetDaemon.it(
	"a second daemon on an occupied listener fails with the address in use and launches no work",
	[boardWork({}, { intervalSeconds: 60 })],
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));

		const collision = yield* daemon.startOnOccupiedPort();

		expect(collision).toContain("EADDRINUSE");
		expect(daemon.providerLaunches()).toEqual([]);
	},
	30_000,
);
