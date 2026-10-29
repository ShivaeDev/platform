import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { host as configuration } from "#test/hostStory.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

describe("work-fleet host configuration", () => {
	configuration.it("defaults leave a hundred working and a hundred in backlog", [], function* (daemon) {
		const host = yield* daemon.loadConfiguration('{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "local" }');
		expect(host).toMatchObject({
			areaMergeWaitMs: 1_800_000,
			backlog: 100,
			concurrency: 100,
			launch: {},
			namespace: "work_fleet",
			quota: "codex",
			readRetryMs: 30_000,
			stallMinutes: 30,
		});
	});

	configuration.it("loads Cloud, worker, database and launch settings from the board file", [], function* (daemon) {
		const config = {
			areaMergeWaitMs: 5000,
			cloud: { cwd: "<workspace-path>", environmentId: "<environment-config-id>" },
			database: { url: "<postgresql-url>" },
			launch: { effort: "<reasoning-effort>", model: "<model>", serviceTier: "<service-tier>" },
			provider: "cloud",
			readRetryMs: 1000,
			stallMinutes: 10,
			worker: { branchPrefix: "<branch-prefix>", sharedEnvironment: "<environment-script-path>" },
		};
		const host = yield* daemon.loadConfiguration(JSON.stringify(config));
		expect(host).toMatchObject({
			areaMergeWaitMs: 5000,
			cloud: config.cloud,
			databaseUrl: config.database.url,
			launch: config.launch,
			provider: "cloud",
			readRetryMs: 1000,
			stallMinutes: 10,
			worker: config.worker,
		});
	});

	configuration.it("--config overrides the board file", [], function* (daemon) {
		const override = yield* daemon.writeConfigurationFile(
			'{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "local", "concurrency": 7, "namespace": "fleet_override" }',
		);
		const host = yield* daemon.loadConfiguration(
			'{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "cloud" }',
			override,
		);
		expect(host).toMatchObject({ concurrency: 7, namespace: "fleet_override", provider: "local" });
	});
	configuration.it("a one-connection pool fails before acquiring the change listener", [], function* (daemon) {
		const host = yield* daemon.loadConfiguration(
			'{ "provider": "local", "database": { "maxConnections": 1, "url": "postgresql://synthetic.invalid/work_fleet" } }',
		);
		const failure = yield* daemon.openDatabase(host).pipe(Effect.flip);
		expect(failure).toMatchObject({
			_tag: "HostFailure",
			message: "Fleet database.maxConnections must be at least 2 for queries and the change listener",
		});
	});
	configuration.it("selects GitHub result adoption explicitly", [], function* (daemon) {
		const host = yield* daemon.loadConfiguration(
			'{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "local", "result": "github" }',
		);
		expect(host.result).toBe("github");
		const invalid = yield* daemon
			.loadConfiguration('{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "local", "result": "unknown" }')
			.pipe(Effect.flip);
		expect(invalid.message).toMatch(/is invalid: /u);
	});

	configuration.it("a missing or invalid file is a host failure", [], function* (daemon) {
		const missing = yield* daemon.loadConfiguration().pipe(Effect.flip);
		expect(missing.message).toMatch(/^Fleet host configuration is missing or unreadable: /u);
		const invalid = yield* daemon.loadConfiguration('{ "provider": "remote", "concurrency": 0 }').pipe(Effect.flip);
		expect(invalid.message).toMatch(/fleet\.config\.json is invalid: /u);
		const namespace = yield* daemon
			.loadConfiguration('{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "local", "namespace": "drop table" }')
			.pipe(Effect.flip);
		expect(namespace.message).toMatch(/is invalid: /u);
	});

	configuration.it("a host file without database.url is refused instead of reaching another project's database", [], function* (daemon) {
		const failure = yield* daemon.loadConfiguration('{ "provider": "local" }').pipe(Effect.flip);
		expect(failure.message).toMatch(/fleet\.config\.json is invalid: Missing key\n\s+at \["database"\]$/u);
		const withoutUrl = yield* daemon.loadConfiguration('{ "provider": "local", "database": { "maxConnections": 4 } }').pipe(Effect.flip);
		expect(withoutUrl.message).toMatch(/fleet\.config\.json is invalid: Missing key\n\s+at \["database"\]\["url"\]$/u);
	});

	configuration.it("provider cloud needs its cloud and worker settings", [], function* (daemon) {
		const failure = yield* daemon
			.loadConfiguration(
				'{ "database": { "url": "postgresql://synthetic.invalid/work_fleet" }, "provider": "cloud", "cloud": { "cwd": "/workspace/repository", "environmentId": "environment-test" } }',
			)
			.pipe(Effect.flip);
		expect(failure.message).toMatch(/selects provider "cloud" without cloud and worker settings$/u);
	});

	configuration.it("loads thread naming, project assignment and the archive opt-out from the host file", [], function* (daemon) {
		const cloud = {
			archiveThreads: false,
			cwd: "/workspace/synthetic",
			environmentId: "synthetic-environment",
			projectId: "synthetic-project",
			threadNamePrefix: "Automation: ",
		};
		const config = {
			cloud,
			database: syntheticDatabase,
			provider: "cloud",
			worker: { branchPrefix: "automation/", sharedEnvironment: "/synthetic/env.sh" },
		};
		const host = yield* daemon.loadConfiguration(JSON.stringify(config));
		expect(host.cloud).toEqual(cloud);
	});
});
