import { rmSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { DiagnosticsSources } from "@shivaedev/work-board/diagnostics/source.ts";
import { HealthPublication } from "#engine/health.ts";
import { GithubApi } from "#host/githubApi.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { withHost } from "#test/fleetHost.ts";
import { GITHUB_RESET, syntheticGithub } from "#test/githubApi.ts";
import { postgresTests } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

const limits = {
	codex: Effect.succeed({ primary: { resetsAt: null, usedPercent: 12, windowDurationMins: 300 }, secondary: null }),
	fleet: Effect.die("Daemon health must come from runtime state"),
	github: Effect.die("GitHub limits must come from Fleet's recorded responses"),
};

postgresTests("live")("Board reads real daemon health, owner counts and Fleet's recorded GitHub budget over HTTP without health files", () =>
	withHost({}, { concurrency: 8 }, (fixture) =>
		Effect.gen(function* () {
			for (const owner of ["automation", "maintainer", "orchestrator"] as const) {
				yield* storeState(fixture.host, owner, { ...statusRecord(owner, "needs-human"), attentionOwner: owner });
			}
			yield* storeState(fixture.host, "queued", statusRecord("queued", "prepared"));
			let codexReads = 0;
			const github = syntheticGithub({ remaining: 4568 });
			github.reply("repos/example/project/pulls/7", { number: 7 });
			const observedLimits = {
				...limits,
				codex: limits.codex.pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							codexReads += 1;
						}),
					),
				),
			};
			const context = yield* Layer.build(
				readDaemonLayer(fixture.host, { ...fixture.parts, github: github.layer }).pipe(
					Layer.provide(Layer.succeed(DiagnosticsSources)(observedLimits)),
				),
			);
			yield* Context.get(context, GithubApi).get("repos/example/project/pulls/7");
			yield* Context.get(context, HealthPublication);
			const address = Context.get(context, HttpServer.HttpServer).address;
			if (!NetAddress.isInetAddress(address)) {
				return yield* Effect.die("Expected a TCP daemon");
			}
			rmSync(join(fixture.host.boardDir, "fleet/health.json"));
			fixture.write("fleet.config.json", "invalid config");
			const { client } = yield* boardHttp(fixture.host.boardDir, undefined, undefined, address.port);
			const data = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
			expect(data.sources).toMatchObject({
				codex: { state: "ready", value: { primary: { usedPercent: 12 } } },
				fleet: { state: "ready", value: { concurrency: 8, queued: 1, running: 0, waiting: { automation: 1, maintainer: 1, orchestrator: 1 } } },
				github: { state: "ready", value: [{ limit: 5000, limitedUntil: null, remaining: 4567, reset: GITHUB_RESET, resource: "core", used: 433 }] },
			});
			const second = yield* boardHttp(fixture.host.boardDir, undefined, undefined, address.port);
			yield* Effect.promise(() => second.client.run(second.client.api.diagnostics.run(undefined)));
			expect(codexReads).toBe(1);
			expect(github.requests.map(({ endpoint }) => endpoint)).toEqual(["repos/example/project/pulls/7"]);
		}),
	),
);
