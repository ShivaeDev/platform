import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { containerReady } from "#test/containerReady.ts";
import { type ConnectionEngine, createConnectionEngine } from "#test/createConnectionEngine.ts";
import { environmentGate } from "#test/environmentGate.ts";
import { attempt, recorded } from "#test/setupOutcome.ts";

const containerChange = Effect.fn("Connections.containerChange")(function* ({ before, state }: ConnectionEngine) {
	const now = yield* state();
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
});

export const connections = storyKit({
	after: {
		container: Effect.fn("Connections.container")(function* (engine) {
			engine.before = yield* engine.state();
		}),
	},
	clock: "live",
	create: createConnectionEngine,
	inspect: ({ before, name, outcome }) => ({ before, name, outcome }),
	layer: NodeServices.layer,
	name: "shared PostgreSQL connections",
	runIf: environmentGate("a local Docker daemon", "docker", ["--host=unix:///var/run/docker.sock", "info"]),
	stages: ["container"],
	verbs: (engine, story) => ({
		container: () => containerChange(engine),
		maxConnections: () => Effect.map(engine.sql("SHOW max_connections"), Number),
		outcome: () => recorded(engine.outcome),
		rows: () => Effect.map(engine.sql("SELECT value FROM kept ORDER BY value"), (value) => value.split("\n")),
		start: Effect.fn("Connections.start")(function* () {
			story.tell("setup starts the shared PostgreSQL service");
			engine.outcome = (yield* attempt(Effect.as(engine.start(engine.connection), "started"))).outcome;
		}),
	}),
});

export function stockContainer({ allowing }: { readonly allowing?: number } = {}) {
	return connections.trait(
		"container",
		allowing === undefined
			? "a stock PostgreSQL container runs, allowing its default 100 connections"
			: `a stock PostgreSQL container runs, configured to allow ${allowing} connections`,
		function* (engine) {
			yield* engine.startStock();
			if (allowing !== undefined) {
				yield* engine.sql(`ALTER SYSTEM SET max_connections = ${allowing}`);
				yield* engine.docker(["restart", engine.name]);
				yield* containerReady(engine.name);
			}
		},
	);
}

export function unpinnedStockContainer() {
	return connections.trait(
		"container",
		"a stock PostgreSQL 18.6 container runs from the pinned image's ID instead of its pinned name, allowing its default 100 connections",
		(engine) => engine.startUnpinned(),
	);
}

export function keptRow() {
	return connections.trait("container", "the container holds the row 'existing data'", (engine) =>
		engine.sql("CREATE TABLE kept (value text NOT NULL); INSERT INTO kept VALUES ('existing data')"),
	);
}

export function setupConnectsAsUnprivilegedRole() {
	return connections.trait("container", "setup connects as a role that may not change server settings", function* (engine) {
		yield* engine.sql("CREATE ROLE unprivileged LOGIN PASSWORD 'local-test'");
		engine.connection = "postgresql://unprivileged:local-test@127.0.0.1:55432/postgres";
	});
}
