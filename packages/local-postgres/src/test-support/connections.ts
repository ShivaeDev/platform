import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type ConnectionEngine, createConnectionEngine } from "#test/createConnectionEngine.ts";
import { attempt, recorded } from "#test/setupOutcome.ts";

function containerChange({ before, state }: ConnectionEngine) {
	const now = state();
	if (now === undefined) {
		return "no container";
	}
	if (before === undefined) {
		return "a new container";
	}
	if (now.id !== before.id) {
		return "a different container";
	}
	return now.startedAt === before.startedAt ? "the same container, still running" : "the same container, restarted";
}

export const connections = storyKit({
	after: {
		container: (engine) => {
			engine.before = engine.state();
		},
	},
	clock: "live",
	create: createConnectionEngine,
	inspect: ({ before, name, outcome }) => ({ before, name, outcome }),
	name: "shared PostgreSQL connections",
	stages: ["container"],
	verbs: (engine, story) => ({
		container: () => Effect.sync(() => containerChange(engine)),
		maxConnections: () => Effect.sync(() => Number(engine.sql("SHOW max_connections"))),
		outcome: () => recorded(engine.outcome),
		rows: () => Effect.sync(() => engine.sql("SELECT value FROM kept ORDER BY value").split("\n")),
		start: () =>
			Effect.sync(() => {
				story.tell("setup starts the shared PostgreSQL service");
				engine.outcome = attempt(() => {
					engine.manager.startPostgres(engine.connection);
					return "started";
				}).outcome;
			}),
	}),
});

export function stockContainer({ allowing }: { readonly allowing?: number } = {}) {
	return connections.trait(
		"container",
		allowing === undefined
			? "a stock PostgreSQL container runs, allowing its default 100 connections"
			: `a stock PostgreSQL container runs, configured to allow ${allowing} connections`,
		(engine) => {
			engine.startStock();
			if (allowing !== undefined) {
				engine.sql(`ALTER SYSTEM SET max_connections = ${allowing}`);
				engine.docker(["restart", engine.name]);
				engine.wait();
			}
		},
	);
}

export function unpinnedStockContainer() {
	return connections.trait(
		"container",
		"a stock PostgreSQL 18.6 container runs from the pinned image's ID instead of its pinned name, allowing its default 100 connections",
		(engine) => {
			engine.startUnpinned();
		},
	);
}

export function keptRow() {
	return connections.trait("container", "the container holds the row 'existing data'", (engine) => {
		engine.sql("CREATE TABLE kept (value text NOT NULL); INSERT INTO kept VALUES ('existing data')");
	});
}

export function setupConnectsAsUnprivilegedRole() {
	return connections.trait("container", "setup connects as a role that may not change server settings", (engine) => {
		engine.sql("CREATE ROLE unprivileged LOGIN PASSWORD 'local-test'");
		engine.connection = "postgresql://unprivileged:local-test@127.0.0.1:55432/postgres";
	});
}
