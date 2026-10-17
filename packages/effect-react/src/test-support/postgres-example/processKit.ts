import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { hasPostgres } from "#test/order-example/postgres.ts";
import { createProcesses, observerLayer, openCluster } from "./processEngine.ts";
import { processVerbs } from "./processVerbs.ts";

export const processes = storyKit({
	clock: "live",
	create: () => createProcesses,
	inspect: (engine) => ({ hints: Object.fromEntries([...engine.clients].map(([name, client]) => [name, client.hints])) }),
	layer: observerLayer,
	name: "order processes",
	runIf: hasPostgres,
	stages: ["cluster"],
	verbs: (engine, story) => processVerbs(engine, story.tell),
});
export function twoServersAndWorker() {
	return processes.trait("cluster", "two HTTP servers and a pg-boss worker share PostgreSQL with three subscribed clients", openCluster);
}
