import { rmSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { DiagnosticsSources } from "@shivaedev/work-board/diagnostics/source.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

const limits = {
	codex: Effect.succeed({ primary: { resetsAt: null, usedPercent: 12, windowDurationMins: 300 }, secondary: null }),
	fleet: Effect.die("Daemon health must come from runtime state"),
	github: Effect.succeed({ core: { limit: 5000, remaining: 4567, reset: 0 }, graphql: { limit: 5000, remaining: 4321, reset: 0 } }),
};

postgresTests("live")("Board reads real daemon health and owner counts over HTTP without health files", () =>
	withHost({}, { concurrency: 8 }, (fixture) =>
		Effect.gen(function* () {
			for (const owner of ["automation", "maintainer", "orchestrator"] as const) {
				yield* storeState(fixture.host, owner, { ...statusRecord(owner, "needs-human"), attentionOwner: owner });
			}
			yield* storeState(fixture.host, "queued", statusRecord("queued", "prepared"));
			let codexReads = 0;
			let githubReads = 0;
			const observedLimits = {
				...limits,
				codex: limits.codex.pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							codexReads += 1;
						}),
					),
				),
				github: limits.github.pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							githubReads += 1;
						}),
					),
				),
			};
			const context = yield* Layer.build(
				readDaemonLayer(fixture.host, fixture.parts).pipe(Layer.provide(Layer.succeed(DiagnosticsSources)(observedLimits))),
			);
			const address = Context.get(context, HttpServer.HttpServer).address;
			if (address._tag !== "TcpAddress") {
				return yield* Effect.die("Expected a TCP daemon");
			}
			rmSync(join(fixture.host.boardDir, "fleet/health.json"));
			fixture.write("fleet.config.json", "invalid config");
			const { client } = yield* boardHttp(fixture.host.boardDir, undefined, undefined, address.port);
			const data = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
			expect(data.sources).toMatchObject({
				codex: { state: "ready", value: { primary: { usedPercent: 12 } } },
				fleet: { state: "ready", value: { concurrency: 8, queued: 1, running: 0, waiting: { automation: 1, maintainer: 1, orchestrator: 1 } } },
				github: { state: "ready", value: { core: { limit: 5000, remaining: 4567 } } },
			});
			const second = yield* boardHttp(fixture.host.boardDir, undefined, undefined, address.port);
			yield* Effect.promise(() => second.client.run(second.client.api.diagnostics.run(undefined)));
			expect(codexReads).toBe(1);
			expect(githubReads).toBe(1);
		}),
	),
);
