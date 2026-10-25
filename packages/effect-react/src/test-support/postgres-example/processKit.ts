import { Effect, Redacted } from "effect";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, hasPostgres } from "#test/order-example/postgres.ts";
import { createProcesses, openCluster } from "./processEngine.ts";
import { processVerbs } from "./processVerbs.ts";

export const processes = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createProcesses,
	inspect: (engine) => ({
		hints: Object.fromEntries([...engine.clients].map(([name, client]) => [name, client.hints])),
		logs: Object.fromEntries([...engine.servers].map(([name, server]) => [name, server.responses])),
	}),
	layer: makePostgresTestLayer({
		initialize: Effect.void,
		maxConnections: 1,
		prepare: false,
		url: Redacted.make(databaseUrl._tag === "Some" ? databaseUrl.value : "postgresql://disabled"),
	}),
	name: "order processes",
	runIf: hasPostgres,
	stages: ["cluster"],
	verbs: (engine, story) => processVerbs(engine, story.tell),
});
export function twoServersAndWorker() {
	return processes.trait("cluster", "two HTTP servers and a pg-boss worker share PostgreSQL with three subscribed clients", openCluster);
}
