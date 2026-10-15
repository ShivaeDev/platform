import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { loadHost } from "#host/config.ts";
import { hostSql } from "#host/runtime.ts";
import { hostBoard } from "#test/fleetHost.ts";

describe("work-fleet host configuration", () => {
	it.effect("defaults leave a hundred executing and a hundred in backlog", function* () {
		const host = yield* loadHost(hostBoard('{ "provider": "local" }')).pipe(Effect.provide(NodeServices.layer));
		expect(host).toMatchObject({
			areaMergeWaitMs: 1_800_000,
			backlog: 100,
			concurrency: 100,
			launch: {},
			namespace: "work_fleet",
			quota: "codex",
			stallMinutes: 30,
		});
	});

	it.effect("loads Cloud, worker, database and launch settings from the board file", function* () {
		const config = {
			areaMergeWaitMs: 5000,
			cloud: { cwd: "<workspace-path>", environmentId: "<environment-config-id>" },
			database: { url: "<postgresql-url>" },
			launch: { effort: "<reasoning-effort>", model: "<model>", serviceTier: "<service-tier>" },
			provider: "cloud",
			stallMinutes: 10,
			worker: { branchPrefix: "<branch-prefix>", sharedEnvironment: "<environment-script-path>" },
		};
		const host = yield* loadHost(hostBoard(JSON.stringify(config))).pipe(Effect.provide(NodeServices.layer));
		expect(host).toMatchObject({
			areaMergeWaitMs: 5000,
			cloud: config.cloud,
			databaseUrl: config.database.url,
			launch: config.launch,
			provider: "cloud",
			stallMinutes: 10,
			worker: config.worker,
		});
	});

	it.effect("--config overrides the board file", function* () {
		const override = join(hostBoard('{ "provider": "local", "concurrency": 7, "namespace": "fleet_override" }'), "fleet.config.json");
		const host = yield* loadHost(hostBoard('{ "provider": "cloud" }'), override).pipe(Effect.provide(NodeServices.layer));
		expect(host).toMatchObject({ concurrency: 7, namespace: "fleet_override", provider: "local" });
	});
	it.effect("a one-connection pool fails before acquiring the change listener", function* () {
		const host = yield* loadHost(hostBoard('{ "provider": "local", "database": { "maxConnections": 1 } }')).pipe(Effect.provide(NodeServices.layer));
		const failure = yield* Layer.build(hostSql(host)).pipe(Effect.scoped, Effect.flip);
		expect(failure).toMatchObject({
			_tag: "HostFailure",
			message: "Fleet database.maxConnections must be at least 2 for queries and the change listener",
		});
	});
	it.effect("selects GitHub result adoption explicitly", function* () {
		const host = yield* loadHost(hostBoard('{ "provider": "local", "result": "github" }')).pipe(Effect.provide(NodeServices.layer));
		expect(host.result).toBe("github");
		const invalid = yield* loadHost(hostBoard('{ "provider": "local", "result": "unknown" }')).pipe(Effect.flip, Effect.provide(NodeServices.layer));
		expect(invalid.message).toMatch(/is invalid: /u);
	});

	it.effect("a missing or invalid file is a host failure", function* () {
		const missing = yield* loadHost(hostBoard()).pipe(Effect.flip, Effect.provide(NodeServices.layer));
		expect(missing.message).toMatch(/^Fleet host configuration is missing or unreadable: /u);
		const invalid = yield* loadHost(hostBoard('{ "provider": "remote", "concurrency": 0 }')).pipe(Effect.flip, Effect.provide(NodeServices.layer));
		expect(invalid.message).toMatch(/fleet\.config\.json is invalid: /u);
		const namespace = yield* loadHost(hostBoard('{ "provider": "local", "namespace": "drop table" }')).pipe(
			Effect.flip,
			Effect.provide(NodeServices.layer),
		);
		expect(namespace.message).toMatch(/is invalid: /u);
	});

	it.effect("provider cloud needs its cloud and worker settings", function* () {
		const failure = yield* loadHost(
			hostBoard('{ "provider": "cloud", "cloud": { "cwd": "/workspace/repository", "environmentId": "environment-test" } }'),
		).pipe(Effect.flip, Effect.provide(NodeServices.layer));
		expect(failure.message).toMatch(/selects provider "cloud" without cloud and worker settings$/u);
	});

	it.effect("loads thread naming, project assignment and the archive opt-out from the host file", function* () {
		const cloud = {
			archiveThreads: false,
			cwd: "/workspace/synthetic",
			environmentId: "synthetic-environment",
			projectId: "synthetic-project",
			threadNamePrefix: "Automation: ",
		};
		const config = { cloud, provider: "cloud", worker: { branchPrefix: "automation/", sharedEnvironment: "/synthetic/env.sh" } };
		const host = yield* loadHost(hostBoard(JSON.stringify(config))).pipe(Effect.provide(NodeServices.layer));
		expect(host.cloud).toEqual(cloud);
	});
});
