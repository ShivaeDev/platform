import { Effect, Redacted } from "effect";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, hasPostgres } from "#test/order-example/postgres.ts";
import { holdPrivateSave, openPrivateCluster, privateVerbs } from "./privateCluster.ts";
import { createProcesses, openCluster } from "./processEngine.ts";
import { processVerbs } from "./processVerbs.ts";

export const processes = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createProcesses,
	inspect: (engine) => ({
		hints: Object.fromEntries([...engine.clients].map(([name, client]) => [name, client.hints.items])),
		logs: Object.fromEntries([...engine.servers].map(([name, server]) => [name, server.responses.items])),
	}),
	layer: makePostgresTestLayer({
		initialize: Effect.void,
		maxConnections: 2,
		prepare: false,
		url: Redacted.make(databaseUrl._tag === "Some" ? databaseUrl.value : "postgresql://disabled"),
	}),
	name: "order processes",
	runIf: hasPostgres,
	stages: ["cluster"],
	verbs: (engine, story) => ({ ...processVerbs(engine, story.tell), ...privateVerbs(engine, story.tell) }),
});
export function twoServersAndWorker() {
	return processes.trait("cluster", "two HTTP servers and a pg-boss worker share PostgreSQL with three subscribed clients", openCluster);
}

export function privateSessionsAcrossHosts() {
	return processes.trait("cluster", "two PostgreSQL hosts with Alice subscribed on both and Bob on the second", openPrivateCluster);
}

export function privateSaveHeld() {
	return processes.trait(
		"cluster",
		"Alice's save of Private title waiting before commit on the first host, with Alice subscribed on both hosts and Bob on the second",
		function* (engine) {
			yield* openPrivateCluster(engine);
			yield* holdPrivateSave(engine, "Private title");
		},
	);
}

export function privateSaveCommitted() {
	return processes.trait("cluster", "Alice's committed save of Private title delivered to her clients on both hosts", function* (engine) {
		yield* openPrivateCluster(engine);
		yield* holdPrivateSave(engine, "Private title");
		yield* privateVerbs(engine, () => undefined).releasePrivateCommit();
		for (const name of ["writer", "reader"]) {
			engine.marks.set(name, engine.privateClients.get(name)?.delivered.items.length ?? 0);
		}
	});
}

export function failedOver() {
	return processes.trait("cluster", "two HTTP servers and a pg-boss worker recovered after PostgreSQL terminated every backend", function* (engine) {
		yield* openCluster(engine);
		yield* processVerbs(engine, () => undefined).terminateBackends();
	});
}
