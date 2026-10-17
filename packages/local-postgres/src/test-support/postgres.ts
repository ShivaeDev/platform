import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { connectCli, createPostgres } from "./postgresEngine.ts";
import { postgresVerbs } from "./postgresVerbs.ts";

export const postgres = storyKit({
	after: { machine: connectCli },
	clock: "live",
	create: createPostgres,
	inspect: (engine) => ({ calls: engine.calls, environment: engine.environment, probes: engine.probes, ready: engine.ready }),
	name: "local postgres",
	run: {
		diagnose: (engine) => `PostgreSQL is not ready after ${engine.probes} probes`,
		maxSteps: 30,
		step(engine, tell) {
			engine.probes += 1;
			try {
				engine.ready = engine.manager.sql("postgresql://postgres:postgres@127.0.0.1:55432/postgres", "SHOW server_version") === "18.6";
			} catch {
				engine.ready = false;
			}
			tell(`readiness attempt ${engine.probes}: ${engine.ready ? "PostgreSQL 18.6 is ready" : "waiting for PostgreSQL"}`);
		},
	},
	stages: ["machine"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		return {
			...postgresVerbs(engine, story.tell),
			checkReadiness: () => story.runUntil((current) => current.ready),
			readinessAttempts: () => engine.probes,
		};
	},
});
